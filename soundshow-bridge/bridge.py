"""Local Sound Show 2 listener. Files never pass through this HTTP server."""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import hmac
import ipaddress
import json
import math
import re
import secrets
import sys
import time
import webbrowser
from pathlib import Path
from urllib.parse import urlsplit

from aiohttp import ClientConnectorError, ClientSession, ClientTimeout, TraceConfig, WSServerHandshakeError, WSMsgType, web

VERSION = '0.3.0'
ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
REPO = Path(__file__).resolve().parent.parent


def finite(value, default=0.0, low=0.0, high=864000.0):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return default
    return max(low, min(high, value))


class ShowState:
    """Consume replacement snapshots, including meaningful empty arrays."""
    def __init__(self):
        self.state = {}
        self.observed_at = 0

    def apply(self, message):
        if not isinstance(message, dict):
            return False
        kind = message.get('type')
        if kind == 'state' and isinstance(message.get('state'), dict):
            self.state = message['state']
            self.observed_at = int(time.time() * 1000)
            return True
        domain = {'players_snapshot':'players', 'playable_runtime_snapshot':'playable_runtime',
                  'control_snapshot':'control', 'logical_devices_snapshot':'logical_devices'}.get(kind)
        if domain and domain in message:
            self.state[domain] = message[domain]
            if domain == 'players':
                self.observed_at = int(time.time() * 1000)
            return True
        return False

    def public(self):
        project = self.state.get('project') or {}
        if not isinstance(project, dict):
            project = {}
        videos = []
        for category in (project.get('categories') or [])[:500]:
            if not isinstance(category, dict):
                continue
            for item in (category.get('playables') or [])[:1000]:
                if not isinstance(item, dict) or item.get('kind') != 'video' or not isinstance(item.get('id'), str):
                    continue
                videos.append({'id':item['id'][:200], 'name':str(item.get('name') or 'Vidéo')[:160]})
        ids = {v['id'] for v in videos}
        players = []
        for item in (self.state.get('players') or [])[:1000]:
            if not isinstance(item, dict) or item.get('kind') != 'video':
                continue
            source = item.get('source_playable_id') or item.get('state_playable_id')
            if source not in ids or not isinstance(item.get('id'), str):
                continue
            players.append({'id':item['id'][:200], 'source':source, 'playing':item.get('is_playing') is True,
                'position':finite(item.get('position_seconds')), 'volume':finite(item.get('volume_percent'),100,0,100)/100,
                'muted':item.get('muted') is True, 'loop':item.get('loop_enabled') is True,
                'start':finite(item.get('start_time_seconds')),
                'stop':finite(item.get('stop_time_seconds'),0), 'observedAt':self.observed_at})
        # No local paths, project secrets, unrelated sounds, or remote password.
        return {'project':str(project.get('name') or '')[:160], 'videos':videos, 'players':players}

    def remote(self):
        """Minimal SoundShow telecommand catalog. No file paths or passwords."""
        project = self.state.get('project') or {}
        media = []
        names = {}
        runtime = {}
        for item in (self.state.get('playable_runtime') or [])[:1000]:
            if isinstance(item,dict) and isinstance(item.get('state_playable_id'),str):
                runtime[item['state_playable_id']] = item
        for category in (project.get('categories') or [])[:200]:
            if not isinstance(category, dict) or category.get('is_hidden') is True:
                continue
            category_name = str(category.get('name') or 'Médias')[:80]
            category_id = str(category.get('id') or category_name)[:200]
            category_color = category.get('color') if isinstance(category.get('color'),str) and re.fullmatch(r'#[0-9a-fA-F]{6}',category['color']) else None
            for item in (category.get('playables') or [])[:1000]:
                if not isinstance(item, dict) or item.get('kind') not in ('sound','video') or not isinstance(item.get('id'), str):
                    continue
                item_id = item['id'][:200]
                name = str(item.get('name') or ('Son' if item['kind']=='sound' else 'Vidéo'))[:160]
                color = item.get('color') if isinstance(item.get('color'),str) and re.fullmatch(r'#[0-9a-fA-F]{6}',item['color']) else category_color
                current = runtime.get(item.get('runtime_state_key') or item_id) or {}
                media.append({'id':item_id,'name':name,'kind':item['kind'],
                    'category':category_name,'categoryId':category_id,
                    'color':color,'categoryColor':category_color,
                    'locked':current.get('is_locked') is True,
                    'playing':current.get('is_playing') is True,
                    'playCount':int(finite(current.get('play_count'),0,0,1000000))})
                names[item_id] = name
                if len(media) >= 500:
                    break
            if len(media) >= 500:
                break
        active = []
        for item in (self.state.get('players') or [])[:1000]:
            if not isinstance(item,dict) or item.get('kind') not in ('sound','video') or not isinstance(item.get('id'),str):
                continue
            source = item.get('source_playable_id') or item.get('state_playable_id')
            if source not in names:
                continue
            active.append({'id':item['id'][:200],'source':source,'name':str(item.get('title') or names[source])[:160],
                'kind':item['kind'],'playing':item.get('is_playing') is True,
                'locked':item.get('is_locked') is True,'muted':item.get('muted') is True,
                'loop':item.get('loop_enabled') is True,
                'volume':round(finite(item.get('volume_percent'),100,0,100))})
        return {'project':str(project.get('name') or '')[:160], 'media':media,'active':active,
            'nextVolume':round(finite((self.state.get('control') or {}).get('next_sound_volume'),100,0,100))}



class SoundShowRedirectError(ValueError):
    pass


async def reject_redirect(session, context, params):
    # The remote password must only reach the address explicitly chosen by the MJ.
    raise SoundShowRedirectError('Unexpected SoundShow redirect')


def local_soundshow_url(value):
    if not isinstance(value, str) or len(value) > 200:
        raise ValueError('Adresse SoundShow invalide.')
    value = value.strip()
    message = 'Colle l’adresse affichée par SoundShow, par exemple http://192.168.1.20:8080/, ou son adresse ws://…/ws.'
    try:
        if any(char.isspace() or ord(char) < 32 for char in value):
            raise ValueError(message)
        url = urlsplit(value)
        host = url.hostname or ''
        address = None if host == 'localhost' else ipaddress.ip_address(host)
        local = host == 'localhost' or address.is_loopback or (
            isinstance(address, ipaddress.IPv4Address) and any(address in network for network in (
                ipaddress.ip_network('10.0.0.0/8'), ipaddress.ip_network('172.16.0.0/12'), ipaddress.ip_network('192.168.0.0/16'))))
        port = url.port
        if not local or '%' in host or url.scheme not in ('http', 'ws') or not port or url.path not in ('', '/', '/ws') or url.query or url.fragment or url.username is not None or url.password is not None:
            raise ValueError(message)
    except ValueError as exc:
        raise ValueError(message) from exc
    if isinstance(address, ipaddress.IPv6Address):
        host = '[' + address.compressed + ']'
    return f'ws://{host}:{port}/ws'


class Bridge:
    def __init__(self, key=None):
        self.key = key or secrets.token_urlsafe(32)
        self.model = ShowState()
        self.status = 'disconnected'
        self.message = 'Connecte SoundShow ou lance la simulation.'
        self.clients = set()
        self.task = None
        self.demo = False
        self.demo_started = 0
        self.remote_ws = None

    def packet(self):
        return {'type':'show', 'version':VERSION, 'status':self.status, 'message':self.message,
                'simulation':self.demo, 'remote':self.model.remote(), **self.model.public()}

    async def publish(self):
        packet = self.packet()
        for client in tuple(self.clients):
            try:
                await asyncio.wait_for(client.send_json(packet), 2)
            except (ConnectionError, RuntimeError, asyncio.TimeoutError):
                self.clients.discard(client)

    async def cancel(self):
        self.remote_ws = None
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
        self.task = None
        self.model = ShowState()
        self.demo = False

    async def connect(self, url, password):
        await self.cancel()
        self.task = asyncio.create_task(self.listen(url, password))

    async def listen(self, url, password):
        delay = 1
        while True:
            heartbeat = None
            self.status, self.message = 'connecting', 'Connexion à SoundShow…'
            await self.publish()
            try:
                trace = TraceConfig()
                trace.on_request_redirect.append(reject_redirect)
                async with ClientSession(timeout=ClientTimeout(total=None, sock_connect=5), trace_configs=[trace]) as client:
                    async with client.ws_connect(url, max_msg_size=8*1024*1024) as ws:
                        await ws.send_json({'type':'hello', 'version':2, 'password':password, 'features':['runtime_snapshots']})
                        hello = await ws.receive_json(timeout=10)
                        if hello.get('type') != 'hello_ok':
                            self.status = 'rejected'
                            self.message = 'Connexion refusée : vérifie le mot de passe et l’accès Pro dans SoundShow.'
                            await self.publish()
                            return  # Never loop on a wrong password.
                        self.remote_ws = ws
                        async def keep_alive():
                            while True:
                                await asyncio.sleep(2)
                                await ws.send_json({'type':'request_state'})
                        heartbeat = asyncio.create_task(keep_alive())
                        delay = 1
                        while True:
                            message = await ws.receive(timeout=25)
                            if message.type == WSMsgType.TEXT:
                                data = json.loads(message.data)
                                if self.model.apply(data):
                                    self.status, self.message = 'connected', 'SoundShow connecté — les raccourcis sont suivis.'
                                    await self.publish()
                            elif message.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                                raise ConnectionError('SoundShow disconnected')
            except asyncio.CancelledError:
                raise
            except SoundShowRedirectError:
                self.model = ShowState()
                self.status, self.message = 'rejected', 'Cette adresse redirige vers un autre service. Recopie l’adresse du serveur distant de SoundShow 2.'
                await self.publish()
                return
            except WSServerHandshakeError as exc:
                self.model = ShowState()
                if exc.status == 403:
                    self.status, self.message = 'rejected', 'Accès refusé : vérifie que SoundShow 2 Pro est activé sur l’ordinateur qui héberge SoundShow.'
                    await self.publish()
                    return
                if exc.status == 404:
                    self.status, self.message = 'rejected', 'L’API SoundShow 2 est introuvable à cette adresse. Vérifie l’adresse du serveur distant et la version 2 du logiciel.'
                    await self.publish()
                    return
                if exc.status == 429:
                    try:
                        delay = max(60, min(600, int((exc.headers or {}).get('Retry-After', '60'))))
                    except ValueError:
                        delay = 60
                self.status, self.message = 'disconnected', 'Serveur SoundShow indisponible. Reconnexion différée.'
                await self.publish()
            except (ClientConnectorError, asyncio.TimeoutError):
                self.model = ShowState()
                self.status = 'disconnected'
                self.message = 'Impossible de joindre SoundShow à cette adresse. Vérifie l’adresse et le port affichés dans SoundShow, puis que son serveur distant est démarré. Nouvelle tentative automatique.'
                await self.publish()
            except Exception:
                self.model = ShowState()
                self.status = 'disconnected'
                self.message = 'SoundShow ne répond plus. Lecture arrêtée ; reconnexion automatique.'
                await self.publish()
            finally:
                self.remote_ws = None
                if heartbeat:
                    heartbeat.cancel()
                    with contextlib.suppress(asyncio.CancelledError, Exception):
                        await heartbeat
            await asyncio.sleep(delay)
            delay = min(delay * 2, 20)

    async def control(self, request):
        """Allowlist remote commands; never forward arbitrary JSON to SoundShow."""
        if not isinstance(request,dict) or len(json.dumps(request)) > 1024:
            raise ValueError('Commande SoundShow invalide.')
        cmd = request.get('type')
        commands = {'stop_all','pause_all','resume_all','fade_out_all',
            'play_playable','toggle_player_playback','stop_player','fade_out_player',
            'set_player_volume','set_next_sound_volume','toggle_player_loop'}
        if cmd not in commands:
            raise ValueError('Commande non autorisée.')
        catalog = self.model.remote()
        media_ids = {item['id'] for item in catalog['media']}
        active_ids = {item['id'] for item in catalog['active'] if not item['locked']}
        result = {'type':cmd}
        if cmd == 'play_playable':
            if request.get('playable_id') not in media_ids:
                raise ValueError('Son ou vidéo introuvable dans le projet actuel.')
            if request.get('action','start') not in ('start','fade_in','crossfade','replace','toggle','toggle_fade'):
                raise ValueError('Mode de lecture invalide.')
            matched = next(item for item in catalog['media'] if item['id'] == request['playable_id'])
            if matched['locked']:
                raise ValueError('Ce son est verrouillé dans SoundShow.')
            result['playable_id'] = request['playable_id']
            result['action'] = request.get('action','start')
        elif cmd in ('toggle_player_playback','stop_player','fade_out_player','set_player_volume','toggle_player_loop'):
            if request.get('player_id') not in active_ids:
                raise ValueError('Ce lecteur n’est plus disponible ou est verrouillé.')
            result['player_id'] = request['player_id']
        if cmd in ('set_player_volume','set_next_sound_volume'):
            volume = request.get('volume')
            if type(volume) is not int or not 0 <= volume <= 100:
                raise ValueError('Volume attendu entre 0 et 100 % (entier).')
            result['volume'] = volume
        if self.demo:
            if cmd in ('play_playable','stop_all','pause_all','resume_all'):
                await self.simulate({'play_playable':'play','stop_all':'stop',
                                     'pause_all':'pause','resume_all':'play'}[cmd])
                return
            raise ValueError('Commande indisponible dans la simulation.')
        ws = self.remote_ws
        if self.status != 'connected' or ws is None or ws.closed:
            raise ConnectionError('SoundShow n’est pas connecté. Aucune commande envoyée.')
        await ws.send_json(result)
        # Send only: SoundShow confirms the effect through later state snapshots.

    async def simulate(self, action):
        if not self.demo:
            await self.cancel()
            self.demo = True
            self.model.apply({'type':'state','state':{'project':{'name':'Essai sans SoundShow','categories':[
                {'playables':[{'id':'demo-video','kind':'video','name':'Vidéo de démonstration'}]}]},'players':[]}})
        now = time.time()
        old = self.model.public()['players']
        position = old[0]['position'] + ((now*1000-old[0]['observedAt'])/1000 if old[0]['playing'] else 0) if old else 0
        players = [] if action == 'stop' else [{'id':'demo-player', 'kind':'video','source_playable_id':'demo-video',
            'is_playing':action != 'pause', 'position_seconds':0 if action == 'restart' else position, 'volume_percent':100}]
        if action == 'init':
            players = []
        self.model.apply({'type':'players_snapshot','players':players})
        self.status, self.message = 'simulation', 'Simulation — aucune commande envoyée à SoundShow.'
        await self.publish()


def create_app(bridge=None):
    bridge = bridge or Bridge()

    @web.middleware
    async def private(request, handler):
        # Loopback binding + Host validation also block DNS rebinding.
        host = request.host.split(':')[0]
        if host not in ('127.0.0.1','localhost'):
            raise web.HTTPForbidden()
        origin = request.headers.get('Origin')
        if origin and origin != 'http://' + request.host:
            raise web.HTTPForbidden()
        if request.path.startswith('/api/') and not hmac.compare_digest(request.headers.get('X-Archives-Key',''), bridge.key):
            raise web.HTTPForbidden()
        response = await handler(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src blob:; connect-src 'self' ws://127.0.0.1:* wss://0.peerjs.com https://0.peerjs.com; frame-ancestors 'none'"
        return response

    app = web.Application(middlewares=[private], client_max_size=8192)

    async def static(request):
        name = request.match_info.get('name') or 'index.html'
        locations = {
            'index.html':ROOT/'web/index.html', 'host.mjs':ROOT/'web/host.mjs', 'style.css':ROOT/'web/style.css',
            'peerjs.min.js':ROOT/'assets/peerjs-1.5.2.min.js', 'protocol.mjs':ROOT/'protocol.mjs'}
        path = locations.get(name)
        if not path:
            raise web.HTTPNotFound()
        if not path.exists() and name == 'peerjs.min.js':
            path = REPO/'assets/peerjs-1.5.2.min.js'
        if not path.exists() and name == 'protocol.mjs':
            path = REPO/'src/soundshow/protocol.mjs'
        if not path.exists():
            raise web.HTTPNotFound()
        return web.FileResponse(path, headers={'Content-Type':{'mjs':'text/javascript','js':'text/javascript','css':'text/css','html':'text/html'}[path.suffix[1:]]})

    async def connect(request):
        body = await request.json()
        try:
            url = local_soundshow_url(body.get('url',''))
            password = body.get('password','')
            if not isinstance(password,str) or not 1 <= len(password) <= 1024:
                raise ValueError('Définis un mot de passe dans SoundShow et recopie-le ici.')
        except (ValueError, AttributeError) as exc:
            return web.json_response({'error':str(exc)},status=400)
        await bridge.connect(url,password)
        return web.json_response({'ok':True})

    async def disconnect(request):
        await bridge.cancel()
        bridge.status,bridge.message = 'disconnected','SoundShow déconnecté.'
        await bridge.publish()
        return web.json_response({'ok':True})

    async def control(request):
        try:
            await bridge.control(await request.json())
        except ValueError as exc:
            return web.json_response({'error':str(exc)},status=400)
        except (ConnectionError,RuntimeError) as exc:
            return web.json_response({'error':str(exc)},status=503)
        return web.json_response({'ok':True,'message':'Commande envoyée à SoundShow ; état en cours de confirmation.'})

    async def demo(request):
        action = (await request.json()).get('action')
        if action not in ('init','play','pause','stop','restart'):
            raise web.HTTPBadRequest()
        await bridge.simulate(action)
        return web.json_response({'ok':True})

    async def events(request):
        if len(bridge.clients) >= 4:
            raise web.HTTPTooManyRequests()
        ws = web.WebSocketResponse(max_msg_size=8192, heartbeat=15)
        await ws.prepare(request)
        try:
            message = await ws.receive_json(timeout=5)
            if not isinstance(message,dict) or not hmac.compare_digest(str(message.get('key','')),bridge.key):
                await ws.close(code=1008)
                return ws
            bridge.clients.add(ws)
            await ws.send_json(bridge.packet())
            async for _ in ws:
                pass  # Browser clients never send SoundShow commands.
        except (asyncio.TimeoutError, ValueError, TypeError):
            await ws.close(code=1008)
        finally:
            bridge.clients.discard(ws)
        return ws

    async def cleanup(_):
        await bridge.cancel()
        for client in tuple(bridge.clients):
            await client.close(code=1001)

    app.router.add_post('/api/connect',connect)
    app.router.add_post('/api/disconnect',disconnect)
    app.router.add_post('/api/demo',demo)
    app.router.add_post('/api/control',control)
    app.router.add_get('/events',events)
    app.router.add_get('/',static)
    app.router.add_get('/{name}',static)
    app.on_cleanup.append(cleanup)
    return app


async def run(args):
    bridge = Bridge()
    runner = web.AppRunner(create_app(bridge),access_log=None)
    await runner.setup()
    site = web.TCPSite(runner,'127.0.0.1',args.port)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    url = f'http://127.0.0.1:{port}/#key={bridge.key}'
    print(f'Archives — SoundShow {VERSION}\nGarde cette fenêtre et le navigateur ouverts. Ferme avec Ctrl+C.\n{url}',flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--no-browser',action='store_true')
    try:
        asyncio.run(run(parser.parse_args()))
    except KeyboardInterrupt:
        pass
