import asyncio
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

spec = importlib.util.spec_from_file_location('bridge',Path(__file__).resolve().parents[1]/'bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class StateTests(unittest.TestCase):
    def test_video_state_is_projected_and_empty_snapshot_stops(self):
        model=bridge.ShowState()
        model.apply({'type':'state','state':{'project':{'name':'Projet','secret':'PRIVATE', 'categories':[{'playables':[
            {'id':'v','name':'Vidéo','kind':'video','path':'C:/PRIVATE/movie.mp4'},
            {'id':'s','kind':'sound','name':'Son privé'}]}]},'players':[
            {'id':'p','kind':'video','source_playable_id':'v','is_playing':True,'position_seconds':12,'volume_percent':50}]}})
        public=model.public()
        self.assertEqual(public['players'][0]['volume'],.5)
        self.assertEqual(public['videos'],[{'id':'v','name':'Vidéo'}])
        self.assertNotIn('PRIVATE',json.dumps(public))
        self.assertNotIn('Son privé',json.dumps(public))
        observed=model.observed_at
        model.apply({'type':'control_snapshot','control':{'irrelevant':True}})
        self.assertEqual(model.observed_at,observed)
        model.apply({'type':'players_snapshot','players':[]})
        self.assertEqual(model.public()['players'],[])

    def test_invalid_numeric_values_are_not_forwarded(self):
        self.assertEqual(bridge.finite(float('nan')),0)
        self.assertEqual(bridge.finite(float('inf')),0)
        self.assertEqual(bridge.finite(True),0)
        self.assertEqual(bridge.finite(-5),0)

    def test_soundshow_links_accept_loopback_and_private_lan_and_preserve_the_port(self):
        cases = {
            'ws://127.0.0.1:8080/ws':'ws://127.0.0.1:8080/ws',
            'ws://localhost:8080/ws':'ws://localhost:8080/ws',
            'http://192.168.1.9:8080/':'ws://192.168.1.9:8080/ws',
            '  http://192.168.1.20:9080/  ':'ws://192.168.1.20:9080/ws',
            'http://127.0.0.1:8081':'ws://127.0.0.1:8081/ws',
            'http://localhost:8080/ws':'ws://localhost:8080/ws',
            'ws://192.168.1.3:8080/ws':'ws://192.168.1.3:8080/ws',
            'http://10.0.0.20:8080/':'ws://10.0.0.20:8080/ws',
            'http://172.16.0.2:8080/':'ws://172.16.0.2:8080/ws',
            'http://172.31.255.254:8080/':'ws://172.31.255.254:8080/ws',
            'http://[::1]:8080/':'ws://[::1]:8080/ws',
        }
        for value, expected in cases.items():
            with self.subTest(value=value):self.assertEqual(bridge.local_soundshow_url(value),expected)

    def test_nonlocal_addresses_credentials_and_unexpected_url_parts_are_refused(self):
        for url in ['ws://evil.test:8080/ws','ws://8.8.8.8:8080/ws','http://169.254.169.254:8080/',
                    'http://172.15.0.1:8080/','http://172.32.0.1:8080/','http://0.0.0.0:8080/',
                    'http://255.255.255.255:8080/','http://[fe80::1]:8080/','http://[::1%25eth0]:8080/',
                    'https://192.168.1.20:8080/','ws://localhost/ws','ws://localhost:0/ws','http://localhost:65536/',
                    'ws://user:password@127.0.0.1:8080/ws','http://@192.168.1.20:8080/',
                    'ws://127.0.0.1:8080/ws?file=secret','ws://127.0.0.1:8080/other','http://192.168.1.20:8080/#password',
                    'http://192.168.\n1.20:8080/']:
            with self.subTest(url=url),self.assertRaises(ValueError):bridge.local_soundshow_url(url)


class ServerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.bridge=bridge.Bridge('test-admin-key')
        self.client=TestClient(TestServer(bridge.create_app(self.bridge),host='127.0.0.1'))
        await self.client.start_server()
        self.headers={'X-Archives-Key':'test-admin-key'}

    async def asyncTearDown(self):
        await self.client.close()

    async def test_admin_api_rejects_guests_and_external_origins(self):
        self.assertEqual((await self.client.post('/api/demo',json={'action':'init'})).status,403)
        self.assertEqual((await self.client.post('/api/demo',json={'action':'init'},headers={**self.headers,'Origin':'https://evil.test'})).status,403)
        self.assertEqual((await self.client.get('/',headers={'Host':'evil.test'})).status,403)
        self.assertEqual((await self.client.get('/bridge.py')).status,404)
        self.assertEqual((await self.client.get('/peerjs.min.js')).status,200)
        self.assertEqual((await self.client.get('/protocol.mjs')).status,200)

    async def test_sound_grid_metadata_keeps_categories_colors_locks_and_no_private_paths(self):
        self.bridge.model.apply({'type':'state','state':{
            'project':{'name':'Scène','categories':[
                {'id':'amb','name':'Ambiances','color':'#2288cc','playables':[
                    {'id':'rain','name':'Pluie','kind':'sound','color':'#aa44cc','runtime_state_key':'rain_state',
                     'path':'C:/private/sound.wav'},
                    {'id':'forest','name':'Forêt','kind':'sound','color':'url(javascript:bad)'},
                    {'id':'movie','name':'Cinématique','kind':'video'}]},
                {'id':'secret','name':'Catégorie cachée','is_hidden':True,'playables':[
                    {'id':'hidden','name':'Secret','kind':'sound'}]}]},
            'playable_runtime':[
                {'state_playable_id':'rain_state','is_playing':True,'is_locked':True,'play_count':4}
            ],
            'players':[]
        }})
        remote=self.bridge.model.remote()
        self.assertEqual([v['id'] for v in remote['media']],['rain','forest','movie'])
        rain=remote['media'][0]
        self.assertEqual(rain['categoryId'],'amb')
        self.assertEqual(rain['color'],'#aa44cc')
        self.assertEqual(rain['categoryColor'],'#2288cc')
        self.assertTrue(rain['playing'])
        self.assertTrue(rain['locked'])
        self.assertEqual(rain['playCount'],4)
        self.assertEqual(remote['media'][1]['color'],'#2288cc')
        self.assertNotIn('C:/private',json.dumps(remote))
        self.assertNotIn('Catégorie cachée',json.dumps(remote))
        ws=AsyncMock();ws.closed=False
        self.bridge.status='connected';self.bridge.remote_ws=ws
        denied=await self.client.post('/api/control',json={
            'type':'play_playable','playable_id':'rain','action':'start'},headers=self.headers)
        self.assertEqual(denied.status,400)
        self.assertEqual(ws.send_json.await_count,0)
        for mode in ('replace','toggle_fade'):
            accepted=await self.client.post('/api/control',json={
                'type':'play_playable','playable_id':'forest','action':mode},headers=self.headers)
            self.assertEqual(accepted.status,200)
        self.assertEqual(ws.send_json.await_count,2)

    async def test_live_player_transport_exposes_timeline_and_validates_seek(self):
        self.bridge.model.apply({'type':'state','state':{
            'project':{'name':'Ambiances','categories':[{'playables':[
                {'id':'rain','kind':'sound','name':'Pluie'}]}]},
            'players':[{'id':'player-1','kind':'sound','source_playable_id':'rain',
                'is_playing':True,'loop_enabled':True,'position_seconds':32.5,
                'duration_seconds':120,'timeline_duration_seconds':120,
                'start_time_seconds':0,'stop_time_seconds':120,'volume_percent':65}]}})
        active=self.bridge.model.remote()['active'][0]
        self.assertEqual(active['position'],32.5)
        self.assertEqual(active['duration'],120)
        self.assertTrue(active['loop'])
        self.assertEqual(active['volume'],65)
        self.assertIsInstance(active['observedAt'],int)
        ws=AsyncMock();ws.closed=False
        self.bridge.remote_ws=ws;self.bridge.status='connected'
        for cmd in [
            {'type':'seek_player','player_id':'player-1','position_percent':40},
            {'type':'toggle_player_loop','player_id':'player-1'},
            {'type':'toggle_player_playback','player_id':'player-1'},
            {'type':'fade_out_player','player_id':'player-1'}
        ]:
            response=await self.client.post('/api/control',json=cmd,headers=self.headers)
            self.assertEqual(response.status,200,cmd)
        self.assertEqual(ws.send_json.await_args_list[0].args[0]['position_percent'],40)
        before=ws.send_json.await_count
        for value in [-1,101,float('nan'),True,'20']:
            response=await self.client.post('/api/control',json={
                'type':'seek_player','player_id':'player-1','position_percent':value},headers=self.headers)
            self.assertEqual(response.status,400)
        self.assertEqual(ws.send_json.await_count,before)

    async def test_remote_controls_sounds_and_videos_with_strict_allowlist(self):
        self.bridge.model.apply({'type':'state','state':{
            'project':{'name':'Campagne','categories':[{'name':'Ambiances','playables':[
                {'id':'rain','kind':'sound','name':'Pluie', 'path':'C:/PRIVATE/rain.wav'},
                {'id':'intro','kind':'video','name':'Introduction'},
                {'id':'not-audio','kind':'action','name':'Danger'}]}]},
            'players':[
                {'id':'rain-playing','kind':'sound','source_playable_id':'rain',
                 'title':'Pluie','is_playing':True,'volume_percent':62},
                {'id':'intro-playing','kind':'video','source_playable_id':'intro',
                 'title':'Introduction','is_playing':False,'volume_percent':85},
                {'id':'locked-playing','kind':'sound','source_playable_id':'rain',
                 'is_locked':True}
            ],'control':{'next_sound_volume':74}}})
        state=self.bridge.model.remote()
        self.assertEqual([item['kind'] for item in state['media']],['sound','video'])
        self.assertEqual([item['id'] for item in state['active']],['rain-playing','intro-playing','locked-playing'])
        self.assertEqual(state['nextVolume'],74)
        self.assertNotIn('PRIVATE',json.dumps(state))
        ws=AsyncMock()
        ws.closed=False
        self.bridge.remote_ws=ws
        self.bridge.status='connected'
        commands=[
            {'type':'play_playable','playable_id':'rain','action':'start'},
            {'type':'play_playable','playable_id':'intro','action':'fade_in'},
            {'type':'pause_all'},
            {'type':'resume_all'},
            {'type':'fade_out_all'},
            {'type':'stop_all'},
            {'type':'toggle_player_playback','player_id':'rain-playing'},
            {'type':'set_player_volume','player_id':'rain-playing','volume':55},
            {'type':'set_next_sound_volume','volume':70},
            {'type':'stop_player','player_id':'intro-playing'}]
        for command in commands:
            response=await self.client.post('/api/control',json=command,headers=self.headers)
            self.assertEqual(response.status,200,(command,await response.text()))
        self.assertEqual(ws.send_json.await_count,len(commands))
        self.assertEqual(ws.send_json.await_args_list[0].args[0],commands[0])
        self.assertEqual(ws.send_json.await_args_list[1].args[0],commands[1])
        self.assertNotIn('play_playable',json.dumps(self.bridge.model.public()['players']))
        for invalid in [
            {'type':'play_playable','playable_id':'not-audio'},
            {'type':'play_playable','playable_id':'unknown'},
            {'type':'play_playable','playable_id':'rain','action':'danger'},
            {'type':'set_player_volume','player_id':'rain-playing','volume':101},
            {'type':'set_player_volume','player_id':'rain-playing','volume':True},
            {'type':'stop_player','player_id':'locked-playing'},
            {'type':'delete_project'},
            {'type':'stop_player','player_id':'unknown'}
        ]:
            response=await self.client.post('/api/control',json=invalid,headers=self.headers)
            self.assertEqual(response.status,400,invalid)
        self.assertEqual(ws.send_json.await_count,len(commands))
        self.assertEqual((await self.client.post('/api/control',json={'type':'stop_all'})).status,403)
        self.assertEqual((await self.client.post('/api/control',json={'type':'stop_all'},headers={
            **self.headers,'Origin':'https://www.owlbear.rodeo'})).status,403)
        self.bridge.remote_ws=None
        self.assertEqual((await self.client.post('/api/control',json={'type':'stop_all'},headers=self.headers)).status,503)

    async def test_demo_runs_without_soundshow_and_authenticates_websocket(self):
        self.assertEqual((await self.client.post('/api/demo',json={'action':'init'},headers=self.headers)).status,200)
        async with self.client.ws_connect('/events') as ws:
            await ws.send_json({'key':'test-admin-key'})
            state=await ws.receive_json(timeout=2)
            self.assertTrue(state['simulation'])
            self.assertEqual(state['players'],[])
            await self.client.post('/api/demo',json={'action':'play'},headers=self.headers)
            state=await ws.receive_json(timeout=2)
            self.assertTrue(state['players'][0]['playing'])
            await self.client.post('/api/demo',json={'action':'pause'},headers=self.headers)
            self.assertFalse((await ws.receive_json(timeout=2))['players'][0]['playing'])
            await self.client.post('/api/demo',json={'action':'stop'},headers=self.headers)
            self.assertEqual((await ws.receive_json(timeout=2))['players'],[])
        async with self.client.ws_connect('/events') as ws:
            await ws.send_json({'key':'wrong'})
            message=await ws.receive(timeout=2)
            self.assertEqual(message.type,web.WSMsgType.CLOSE)

    async def test_native_api_handshake_and_snapshots_follow_a_shortcut(self):
        received=[]
        async def fake(request):
            ws=web.WebSocketResponse();await ws.prepare(request)
            hello=await ws.receive_json(timeout=2);received.append(hello)
            await ws.send_json({'type':'hello_ok','features':['runtime_snapshots']})
            await ws.send_json({'type':'state','state':{'project':{'categories':[]},'players':[]}})
            # A launch originating in SoundShow, rather than a command from us.
            await ws.send_json({'type':'state','state':{'project':{'categories':[{'playables':[
                {'id':'video','kind':'video','name':'Raccourci vidéo'}]}]},'players':[
                {'id':'instance','kind':'video','source_playable_id':'video','is_playing':True,'position_seconds':3}]}})
            async for message in ws:
                if message.type==web.WSMsgType.TEXT:received.append(json.loads(message.data))
            return ws
        app=web.Application();app.router.add_get('/ws',fake)
        async with TestServer(app,host='127.0.0.1') as server:
            # Paste the HTTP remote link exactly as SoundShow displays it.
            url=str(server.make_url('/'))
            response=await self.client.post('/api/connect',json={'url':url,'password':'SENSITIVE_PASSWORD'},headers=self.headers)
            self.assertEqual(response.status,200)
            for _ in range(100):
                if self.bridge.model.public()['players']:break
                await asyncio.sleep(.01)
            state=self.bridge.packet()
            self.assertEqual(state['players'][0]['source'],'video')
            self.assertTrue(state['players'][0]['playing'])
            self.assertNotIn('SENSITIVE_PASSWORD',json.dumps(state))
            self.assertEqual(received[0]['type'],'hello')
            self.assertEqual(received[0]['features'],['runtime_snapshots'])
            self.assertFalse(any(item.get('type','').startswith('play') for item in received))
            await self.bridge.cancel()

    async def test_authenticated_http_lan_link_is_normalized_before_native_connection(self):
        with patch.object(self.bridge,'connect',new_callable=AsyncMock) as connect:
            response=await self.client.post('/api/connect',json={'url':'http://192.168.1.9:8080/','password':'SENSITIVE_PASSWORD'},headers=self.headers)
            self.assertEqual(response.status,200)
            connect.assert_awaited_once_with('ws://192.168.1.9:8080/ws','SENSITIVE_PASSWORD')
            self.assertNotIn('SENSITIVE_PASSWORD',await response.text())

    async def test_redirect_is_refused_before_password_can_be_sent_to_another_endpoint(self):
        received=[]
        async def redirect(request):
            raise web.HTTPFound('/redirected')
        async def destination(request):
            received.append(1)
            return web.Response()
        app=web.Application();app.router.add_get('/ws',redirect);app.router.add_get('/redirected',destination)
        async with TestServer(app,host='127.0.0.1') as server:
            await self.bridge.connect(str(server.make_url('/ws')).replace('http:','ws:'),'SENSITIVE_PASSWORD')
            for _ in range(100):
                if self.bridge.status=='rejected':break
                await asyncio.sleep(.01)
            self.assertEqual(self.bridge.status,'rejected')
            self.assertIn('redirige',self.bridge.message)
            self.assertEqual(received,[])
            self.assertNotIn('SENSITIVE_PASSWORD',json.dumps(self.bridge.packet()))

    async def test_closed_server_reports_an_address_and_port_failure(self):
        server=TestServer(web.Application(),host='127.0.0.1');await server.start_server()
        url=str(server.make_url('/ws')).replace('http:','ws:');await server.close()
        await self.bridge.connect(url,'SENSITIVE_PASSWORD')
        for _ in range(100):
            if self.bridge.status=='disconnected' and 'Impossible de joindre' in self.bridge.message:break
            await asyncio.sleep(.01)
        self.assertEqual(self.bridge.status,'disconnected')
        self.assertIn('adresse et le port',self.bridge.message)
        self.assertNotIn('SENSITIVE_PASSWORD',json.dumps(self.bridge.packet()))

    async def test_wrong_soundshow_password_does_not_retry(self):
        calls=[]
        async def fake(request):
            calls.append(1);ws=web.WebSocketResponse();await ws.prepare(request);await ws.receive_json()
            await ws.send_json({'type':'hello_rejected','reason':'invalid_password'});await ws.close();return ws
        app=web.Application();app.router.add_get('/ws',fake)
        async with TestServer(app,host='127.0.0.1') as server:
            await self.bridge.connect(str(server.make_url('/ws')).replace('http:','ws:'),'wrong')
            for _ in range(100):
                if self.bridge.status=='rejected':break
                await asyncio.sleep(.01)
            await asyncio.sleep(.1)
            self.assertEqual(self.bridge.status,'rejected')
            self.assertEqual(len(calls),1)

    async def test_pro_access_refusal_stops_instead_of_reconnecting(self):
        calls=[]
        async def fake(request):
            calls.append(1)
            raise web.HTTPForbidden()
        app=web.Application();app.router.add_get('/ws',fake)
        async with TestServer(app,host='127.0.0.1') as server:
            await self.bridge.connect(str(server.make_url('/ws')).replace('http:','ws:'),'password')
            for _ in range(100):
                if self.bridge.status=='rejected':break
                await asyncio.sleep(.01)
            await asyncio.sleep(.1)
            self.assertEqual(self.bridge.status,'rejected')
            self.assertEqual(len(calls),1)

    async def test_missing_v2_endpoint_reports_the_version_and_stops_retrying(self):
        calls=[]
        async def fake(request):
            calls.append(1)
            raise web.HTTPNotFound()
        app=web.Application();app.router.add_get('/ws',fake)
        async with TestServer(app,host='127.0.0.1') as server:
            await self.bridge.connect(str(server.make_url('/ws')).replace('http:','ws:'),'password')
            for _ in range(100):
                if self.bridge.status=='rejected':break
                await asyncio.sleep(.01)
            await asyncio.sleep(.1)
            self.assertEqual(self.bridge.status,'rejected')
            self.assertIn('API SoundShow 2',self.bridge.message)
            self.assertEqual(len(calls),1)


if __name__=='__main__':unittest.main()
