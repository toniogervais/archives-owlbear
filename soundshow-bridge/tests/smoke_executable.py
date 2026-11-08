import re
import subprocess
import sys
import urllib.error
import urllib.request

process=subprocess.Popen([sys.argv[1],'--no-browser'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
    for _ in range(20):
        line=process.stdout.readline()
        match=re.search(r'(http://127\.0\.0\.1:\d+/)#key=([A-Za-z0-9_-]+)',line)
        if match:break
    else:raise RuntimeError('The executable did not start its local interface.')
    root,key=match.groups()
    for name,expected in [('',b'SoundShow'),('host.mjs',b'encodeSession'),('peerjs.min.js',b'Peer'),('protocol.mjs',b'validSession')]:
        with urllib.request.urlopen(root+name,timeout=5) as response:
            assert response.status==200 and expected in response.read()
    request=urllib.request.Request(root+'api/demo',data=b'{"action":"init"}',headers={'Content-Type':'application/json','X-Archives-Key':key},method='POST')
    with urllib.request.urlopen(request,timeout=5) as response:assert response.status==200
    print('Standalone Windows executable: interface, bundled assets and simulation: OK')
finally:
    process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill()
