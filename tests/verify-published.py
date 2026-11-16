"""Compare the deployed static files with the exact published commit."""
import concurrent.futures
import hashlib
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://toniogervais.github.io/archives-owlbear/"
revision = os.environ.get("GITHUB_SHA") or subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
paths = subprocess.check_output(["git", "diff", "--name-only", "--diff-filter=ACMRT", "HEAD^", "HEAD"], text=True).splitlines()
assets = [p for p in paths if Path(p).is_file() and
          ((p.startswith("src/") and Path(p).suffix in {".mjs", ".js", ".css"}) or
           ("/" not in p and Path(p).suffix in {".html", ".json"} and not p.startswith("package")))]
if not assets:
    raise SystemExit("No changed static assets found")
def check(path):
    expected = hashlib.sha256(Path(path).read_bytes()).digest()
    url = BASE + urllib.parse.quote(path) + "?published=" + revision[:16]
    last = ""
    for attempt in range(12):
        try:
            request = urllib.request.Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Archives-release-verification"})
            with urllib.request.urlopen(request, timeout=25) as response:
                actual = hashlib.sha256(response.read()).digest()
            if actual == expected:
                return path, None
            last = "published bytes differ"
        except (OSError, urllib.error.URLError) as error:
            last = str(error)
        time.sleep(5)
    return path, last
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(check, assets))
failures = [(path, error) for path, error in results if error]
for path, error in failures:
    print(path + ": " + error)
print(str(len(results) - len(failures)) + "/" + str(len(results)) + " static files match the published commit " + revision[:12])
raise SystemExit(bool(failures))
