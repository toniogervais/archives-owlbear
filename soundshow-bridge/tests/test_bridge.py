import asyncio
import importlib.util
import json
import sys
import unittest
from pathlib import Path

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

    def test_only_the_soundshow_instance_on_this_pc_can_be_contacted(self):
        self.assertEqual(bridge.local_soundshow_url('ws://127.0.0.1:8080/ws'),'ws://127.0.0.1:8080/ws')
        self.assertEqual(bridge.local_soundshow_url('ws://localhost:8080/ws'),'ws://localhost:8080/ws')
        for url in ['ws://192.168.1.3:8080/ws','ws://evil.test:8080/ws','http://127.0.0.1:8080/ws',
                    'ws://user:password@127.0.0.1:8080/ws','ws://127.0.0.1:8080/ws?file=secret','ws://127.0.0.1:8080/other']:
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
            url=str(server.make_url('/ws')).replace('http:','ws:',1)
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


if __name__=='__main__':unittest.main()
