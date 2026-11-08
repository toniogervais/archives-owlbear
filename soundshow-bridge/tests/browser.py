"""Real Chromium/WebRTC journey; local signalling and a fake SoundShow only."""
import asyncio
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from aiohttp import web
from aiohttp.test_utils import TestServer
from playwright.async_api import async_playwright

BASE=Path(__file__).resolve().parents[1]
REPO=BASE.parent
spec=importlib.util.spec_from_file_location('bridge',BASE/'bridge.py')
bridge=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


async def wait_expression(page, expression, timeout=20000):
    # Playwright's wait_for_function uses eval(), which our production CSP rejects.
    # Evaluate the predicate via the debugger without weakening that CSP.
    deadline=time.monotonic()+timeout/1000
    while time.monotonic()<deadline:
        if await page.evaluate(expression):return
        await asyncio.sleep(.05)
    raise AssertionError('Browser condition did not become true: '+expression)


class FakeShow:
    def __init__(self):
        self.sockets=set()
        self.commands=[]
        self.state={'project':{'name':'Premier essai','categories':[{'playables':[
            {'id':'movie','name':'Vidéo de test','kind':'video'}]}]},'players':[]}

    async def websocket(self,request):
        ws=web.WebSocketResponse();await ws.prepare(request)
        hello=await ws.receive_json();self.commands.append(hello)
        assert hello['type']=='hello' and hello['version']==2
        self.sockets.add(ws)
        await ws.send_json({'type':'hello_ok','features':['runtime_snapshots']})
        await ws.send_json({'type':'state','state':self.state})
        try:
            async for message in ws:
                if message.type!=web.WSMsgType.TEXT:continue
                data=json.loads(message.data);self.commands.append(data)
                if data['type']=='request_state':
                    # Like SoundShow, report an advancing position.
                    if self.state['players'] and self.state['players'][0]['is_playing']:
                        self.state['players'][0]['position_seconds']+=2
                    await ws.send_json({'type':'state','state':self.state})
        finally:self.sockets.discard(ws)
        return ws

    async def emit(self,playing=True,position=0,volume=100,stop=False,loop=False):
        self.state['players']=[] if stop else [{'id':'runtime-movie','kind':'video','source_playable_id':'movie',
            'is_playing':playing,'position_seconds':position,'volume_percent':volume,'loop_enabled':loop}]
        for ws in self.sockets:
            await ws.send_json({'type':'players_snapshot','players':self.state['players']})


def add_signalling(app):
    peers={}
    async def identity(request):return web.Response(text=str(uuid.uuid4()))
    async def socket(request):
        peer_id=request.query['id'];ws=web.WebSocketResponse();await ws.prepare(request);peers[peer_id]=ws
        await ws.send_json({'type':'OPEN'})
        try:
            async for message in ws:
                if message.type!=web.WSMsgType.TEXT:continue
                data=json.loads(message.data)
                if data.get('type')=='HEARTBEAT':continue
                target=peers.get(data.get('dst'))
                if target is not None and not target.closed:await target.send_json({**data,'src':peer_id})
        finally:
            if peers.get(peer_id) is ws:peers.pop(peer_id,None)
        return ws
    app.router.add_get('/signal/peerjs/id',identity)
    app.router.add_get('/signal/peerjs',socket)


async def main():
    fake=FakeShow();fake_app=web.Application();fake_app.router.add_get('/ws',fake.websocket)
    native=bridge.Bridge('browser-test-admin');app=bridge.create_app(native);add_signalling(app)
    async def source(request):
        name=request.match_info['name'];path=REPO/'src/soundshow'/name
        if name not in ('player.mjs','player.css','connection.mjs','protocol.mjs'):raise web.HTTPNotFound()
        return web.FileResponse(path,headers={'Content-Type':'text/css' if name.endswith('.css') else 'text/javascript'})
    async def player_html(request):
        return web.Response(text='<!doctype html><meta name="viewport" content="width=device-width"><script src="/peerjs.min.js" defer></script><script type="module" src="/test/player.mjs"></script>',content_type='text/html')
    async def player_script(request):
        return web.Response(text="import {mountPlayer} from '/test/src/player.mjs';import{decodeSession}from'/test/src/protocol.mjs';window.player=mountPlayer();window.attach=code=>player.use(decodeSession(code));window.waitingReader=()=>{player.destroy();window.player=mountPlayer({showWaiting:true});};",content_type='text/javascript')
    app.router.add_get('/test/src/{name}',source)
    app.router.add_get('/test/player',player_html)
    app.router.add_get('/test/player.mjs',player_script)
    with tempfile.TemporaryDirectory(prefix='soundshow-video-test-') as folder:
        video=Path(folder)/'test.mp4'
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24',
            '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','30','-c:v','libx264','-preset','ultrafast',
            '-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(video)],check=True)
        async with TestServer(fake_app,host='127.0.0.1') as soundshow,TestServer(app,host='127.0.0.1') as server:
            async with async_playwright() as p:
                executable=os.environ.get('ARCHIVES_CHROMIUM') or (shutil.which('chromium') if not Path(p.chromium.executable_path).exists() else None)
                browser=await p.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox','--autoplay-policy=user-gesture-required'])
                errors=[]
                try:
                    options={'host':'127.0.0.1','port':server.port,'path':'/signal/','secure':False,'config':{'iceServers':[]}}
                    context=await browser.new_context()
                    await context.add_init_script('window.ArchivesSoundShowPeerOptions='+json.dumps(options)+';window.showOpenFilePicker=undefined;')
                    host=await context.new_page();host.on('pageerror',lambda error:errors.append(str(error)))
                    host.on('console',lambda msg:print('Browser console: '+msg.text,flush=True) if msg.type=='error' else None)
                    await host.goto(str(server.make_url('/'))+'#key=browser-test-admin')
                    await host.locator('#address').fill(str(soundshow.make_url('/')))
                    await host.locator('#password').fill('native-password')
                    await host.get_by_role('button',name='Connecter SoundShow',exact=True).click()
                    await host.get_by_text('SoundShow connecté — les raccourcis sont suivis.',exact=True).wait_for()
                    async with host.expect_file_chooser() as picker:
                        await host.get_by_role('button',name='Choisir la vidéo',exact=True).click()
                    await (await picker.value).set_files(str(video))
                    # The host prepares pairing automatically after SoundShow connects.
                    # Opening the advanced panel or pressing "Prepare" is no longer required.
                    await wait_expression(host,"document.getElementById('pair-code').value.startsWith('SS2.')")
                    assert await host.get_by_role('button',name='Ouvrir Les Archives et relier les joueurs').is_visible()
                    code=await host.locator('#pair-code').input_value()
                    player_context=await browser.new_context(viewport={'width':800,'height':1100},has_touch=True)
                    await player_context.add_init_script('window.ArchivesSoundShowPeerOptions='+json.dumps(options))
                    tablet=await player_context.new_page();tablet.on('pageerror',lambda error:errors.append(str(error)))
                    await tablet.goto(str(server.make_url('/test/player')))
                    await wait_expression(tablet,'!!window.attach')
                    await tablet.evaluate('code=>window.attach(code)',code)
                    try:
                        await host.get_by_text('1 lecteur(s) connecté(s).',exact=True).wait_for()
                    except Exception:
                        print('Host connection status:',await host.locator('#peer-status').text_content(),flush=True)
                        print('Receiver connection status:',await tablet.locator('.soundshow-view footer').text_content(),flush=True)
                        print('Receiver transport:',await tablet.evaluate('''()=>{const c=window.player.connection,p=c.connection?.peerConnection;return{peerOpen:c.peer?.open,peerDisconnected:c.peer?.disconnected,dataOpen:c.connection?.open,rtc:p?.connectionState,ice:p?.iceConnectionState,gathering:p?.iceGatheringState};}'''),flush=True)
                        raise
                    print('Native connection and paired tablet: OK',flush=True)
                    await fake.emit(playing=True)
                    await wait_expression(tablet,'document.querySelector("video").videoWidth>0')
                    await wait_expression(tablet,'document.querySelector("video").currentTime>0')
                    assert await host.locator('#source').evaluate('(video)=>video.muted')
                    assert await tablet.locator('video').evaluate('(video)=>video.srcObject.getAudioTracks().length')==1
                    # A tablet with blocked autoplay gets a real, working authorisation button.
                    allow=tablet.get_by_role('button',name='Autoriser l’image et le son',exact=True)
                    if await allow.is_visible():await allow.click()
                    audio_peak=await tablet.evaluate('''async()=>{const c=new AudioContext();await c.resume();const s=c.createMediaStreamSource(document.querySelector('video').srcObject),a=c.createAnalyser();s.connect(a);await new Promise(r=>setTimeout(r,200));const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);const peak=Math.max(...data.map(Math.abs));await c.close();return peak;}''')
                    assert audio_peak>.001, f'The real received audio is silent: {audio_peak}'
                    print('Real picture and audible media over WebRTC: OK',flush=True)
                    await fake.emit(playing=False,position=2,volume=35)
                    await wait_expression(tablet,'document.querySelector("video").paused && Math.abs(document.querySelector("video").volume-.35)<.01')
                    await fake.emit(playing=True,position=8,volume=60)
                    await wait_expression(host,'document.getElementById("source").currentTime>=8')
                    await wait_expression(tablet,'!document.querySelector("video").paused')
                    await tablet.screenshot(path='/tmp/archives-soundshow-tablet.png')
                    await tablet.get_by_role('button',name='Revenir au jeu',exact=True).click()
                    await fake.emit(playing=True,position=9,volume=60)
                    await asyncio.sleep(.2)
                    assert await tablet.locator('.soundshow-view').evaluate('(view)=>view.hidden'), 'A dismissed video must not reopen on a volume/position update.'
                    await fake.emit(stop=True)
                    await wait_expression(tablet,'document.querySelector(".soundshow-view").hidden')
                    await fake.emit(playing=True)
                    await wait_expression(tablet,'!document.querySelector(".soundshow-view").hidden && document.querySelector("video").videoWidth>0')
                    await fake.emit(stop=True)
                    await wait_expression(tablet,'document.querySelector(".soundshow-view").hidden')
                    print('Pause, volume, seek, resume, stop: OK',flush=True)
                    # The Owlbear waiting mode shows connection status before a cue
                    # and still receives real video when the source starts later.
                    await tablet.evaluate('()=>window.waitingReader()')
                    await tablet.evaluate('code=>window.attach(code)',code)
                    await tablet.get_by_text('Prêt — en attente d’une vidéo du MJ.',exact=True).wait_for()
                    assert not await tablet.locator('.soundshow-view').evaluate('(view)=>view.hidden')
                    await fake.emit(playing=True)
                    await wait_expression(tablet,'document.querySelector("video").videoWidth>0 && document.querySelector("video").currentTime>0')
                    await fake.emit(stop=True)
                    await tablet.get_by_text('Prêt — en attente d’une vidéo du MJ.',exact=True).wait_for()
                    print('Visible waiting reader and real media after later source start: OK',flush=True)
                    # First launch of an already-looping video must wrap the timeline.
                    # Without this correction the source started at its very last frame.
                    await fake.emit(playing=True,position=65,loop=True)
                    await wait_expression(host,'document.querySelector("#source").loop && document.querySelector("#source").currentTime > 4 && document.querySelector("#source").currentTime < 10')
                    await wait_expression(tablet,'document.querySelector("video").videoWidth>0')
                    await fake.emit(stop=True)
                    print('Looping source wraps on its initial frame: OK',flush=True)
                    # No old video or launch is replayed by a local dashboard reload.
                    await host.reload()
                    await host.get_by_text('SoundShow connecté — les raccourcis sont suivis.',exact=True).wait_for()
                    assert not any(command.get('type','').startswith('play') for command in fake.commands)
                    assert not errors,errors
                    print('Reload, no replayed SoundShow command, no browser errors: OK',flush=True)
                    await player_context.close();await context.close()
                finally:
                    await browser.close();await native.cancel()


if __name__=='__main__':asyncio.run(main())
