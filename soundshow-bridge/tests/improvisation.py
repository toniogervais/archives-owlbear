"""Exercise the real Archives controller, media capture and receiver with a synthetic projection window."""
from time import monotonic
from urllib.parse import urlsplit


async def exercise(host, context, tablet, fake, file, repo, wait, audible):
    origin = 'https://toniogervais.github.io/archives-owlbear/'
    async def serve_archives(route):
        path = (repo / urlsplit(route.request.url).path.removeprefix('/archives-owlbear/')).resolve()
        if not path.is_relative_to(repo) or not path.is_file():
            await route.abort()
            return
        mime = {'html': 'text/html', 'mjs': 'text/javascript', 'js': 'text/javascript', 'css': 'text/css'}
        await route.fulfill(path=path, content_type=mime.get(path.suffix[1:]))

    await context.route(origin+'**', serve_archives)
    await context.route('https://cdn.jsdelivr.net/**', lambda route: route.fulfill(body='',content_type='text/javascript'))
    async with host.expect_popup() as opened:
        await host.get_by_role('button',name='Ouvrir les Archives du MJ').click()
    archives = await opened.value
    await archives.wait_for_url("**/archives-app-v64-v55.html*", wait_until="load")
    await wait(archives,'!!window.ArchivesSoundShow?.getSoundDock()')
    await archives.locator('#archives-title-screen').wait_for(state='hidden')
    await archives.get_by_role('button',name='Sons — ouvrir la grille SoundShow').click()
    before = sum(cmd.get('playable_id')=='rain' for cmd in fake.commands)
    await archives.locator('.ss-tile[data-id="rain"]').click()
    await wait(archives, '!!window.ArchivesSoundShow')
    await host.get_by_text('Télécommande reliée aux Archives du MJ.',exact=True).wait_for()
    await archives.get_by_role('button',name='Vidéos SoundShow',exact=True).click()
    assert sum(cmd.get('playable_id')=='rain' for cmd in fake.commands) == before+1
    # A new file with no registered SoundShow button goes through the real MJ picker.
    async with archives.expect_file_chooser() as picker:
        await archives.get_by_role('button',name='Diffuser une vidéo du PC…').click()
    unlisted = file.with_name('improvisation.webm')
    unlisted.write_bytes(file.read_bytes())
    start = monotonic()
    await (await picker.value).set_files(str(unlisted))
    await wait(tablet, "document.querySelector('video').videoWidth>0 && !document.querySelector('video').paused && document.querySelector('h2').textContent==='Vidéo du MJ'")
    await audible(tablet)
    print(f'Unlisted PC file reached the player with audio in {1000*(monotonic()-start):.0f} ms, including audio verification', flush=True)
    await archives.get_by_role('button',name='Arrêter la vidéo du PC').click()
    await wait(tablet, "!window.player.connection.playback.active")
    # Real audio and video tracks, controlled only at the OS chooser boundary.
    await host.evaluate("""()=>{
      navigator.mediaDevices.getDisplayMedia=async options=>{
        if(options.systemAudio!=='exclude')throw Error('Unexpected system audio capture');
        const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
        const ctx=canvas.getContext('2d');window.testColour='rgb(220,20,30)';
        function draw(){ctx.fillStyle=window.testColour;ctx.fillRect(0,0,320,180);}
        draw();setInterval(draw,45);
        const out=canvas.captureStream(24),track=out.getVideoTracks()[0];
        const settings=track.getSettings.bind(track);track.getSettings=()=>({...settings(),displaySurface:'window'});
        const audio=new AudioContext(),osc=audio.createOscillator(),dest=audio.createMediaStreamDestination();
        osc.connect(dest);osc.start();await audio.resume();out.addTrack(dest.stream.getAudioTracks()[0]);
        window.testCapture=out;return out;
      };
    }""")
    await host.get_by_role('button',name='Partager la fenêtre de projection').click()
    await wait(tablet, "!!window.player.connection.call?.peerConnection && window.player.connection.call.peerConnection.connectionState==='connected' && !!window.player.connection.videoTrack")
    await tablet.evaluate('window.warmCall=window.player.connection.call')
    assert await host.evaluate('testCapture.getTracks().every(track=>!track.enabled)')
    # Use a live video source missing from the current project catalog and file associations.
    async def cue(instance):
        players=[{'id':instance,'source_playable_id':'new-uncatalogued-video','kind':'video','is_playing':True}]
        fake.state['players']=players
        for socket in fake.sockets:
            await socket.send_json({'type':'players_snapshot','players':players})

    await tablet.evaluate("""window.visibleColour=channel=>{
      const v=document.querySelector('video');if(!v.videoWidth||v.paused)return false;
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
      const ctx=canvas.getContext('2d');ctx.drawImage(v,0,0,1,1);
      const rgb=ctx.getImageData(0,0,1,1).data;
      return rgb[channel]>120 && rgb[channel]>rgb[1-channel]*2;
    }""")
    for idx,colour in enumerate(['rgb(220,20,30)','rgb(20,220,30)']):
        await host.evaluate('colour=>window.testColour=colour',colour)
        start=monotonic()
        await cue('instance-'+str(idx))
        await wait(tablet,'window.visibleColour('+str(idx)+')')
        print(f'Warm projection {idx+1}: {1000*(monotonic()-start):.0f} ms to first coloured frame',flush=True)
        assert await tablet.evaluate('window.player.connection.call===window.warmCall')
        await audible(tablet)
        await fake.emit(stop=True)
        await wait(tablet,'!window.player.connection.playback.active')
        assert await host.evaluate('testCapture.getTracks().every(track=>!track.enabled)')
    await host.get_by_role('button',name='Arrêter le partage',exact=True).click()
    await wait(host,"testCapture.getTracks().every(track=>track.readyState==='ended')")
    before=sum(cmd.get('type')=='play_playable' for cmd in fake.commands)
    await host.evaluate('''async()=>{
      const response=await fetch('/api/disconnect',{method:'POST',headers:{'X-Archives-Key':sessionStorage.getItem('archives-soundshow-admin')}});
      if(!response.ok)throw Error('Local test disconnect failed');
    }''')
    await host.get_by_text('SoundShow déconnecté.',exact=True).wait_for()
    async with archives.expect_file_chooser() as picker:
        await archives.get_by_role('button',name='Diffuser une vidéo du PC…').click()
    await (await picker.value).set_files(str(unlisted))
    await wait(tablet, "window.player.connection.playback.active && document.querySelector('video').videoWidth>0")
    await audible(tablet)
    await archives.get_by_role('button',name='Arrêter la vidéo du PC').click()
    await wait(tablet,'!window.player.connection.playback.active')
    assert sum(cmd.get('type')=='play_playable' for cmd in fake.commands)==before
    await host.locator('#password').fill('native-password')
    await host.get_by_role('button',name='Connecter SoundShow',exact=True).click()
    await host.get_by_text('SoundShow connecté — les raccourcis sont suivis.',exact=True).wait_for()
    await archives.close()
