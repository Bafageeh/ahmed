#!/usr/bin/env python3
"""Compare every runtime source and mobile asset with the selected commit, read-only."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
sha = os.environ['AHMED_SMS_SHA']
case = Path(os.environ.get('AHMED_APK_CASE', '/home/pmsa/secure-backups/ahmed/latest-apk-20261026'))
excluded = {'.git', 'node_modules', '.expo', 'build', '.gradle', 'dist-web', 'dist', 'apk', 'build-output', 'Pods', 'vendor', 'cache'}
extensions = {'.js', '.jsx', '.ts', '.tsx', '.json', '.kt', '.java', '.xml', '.gradle', '.kts', '.php', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ttf', '.otf'}
sources = ['ahmed-mobile', 'ahmed-api/app', 'ahmed-api/routes', 'ahmed-api/bootstrap', 'ahmed-api/config', 'ahmed-api/database/migrations', 'ahmed-api/tests']


def included(name):
    path = Path(name)
    return (any(name.startswith(base + '/') for base in sources) and path.suffix in extensions
        and not any(part in excluded for part in path.parts) and not path.name.startswith('.')
        and not any(word in path.name.lower() for word in ['credential', 'private-key', 'google-services', 'service-account']))


expected = {}
for line in subprocess.check_output(['git', 'ls-tree', '-r', sha], cwd=root).decode().splitlines():
    metadata, name = line.split('\t', 1)
    if included(name): expected[name] = metadata.split()[2]
actual = {}
for base in sources:
    for path in (root / base).rglob('*'):
        name = str(path.relative_to(root))
        if not included(name) or not path.is_file() or path.is_symlink(): continue
        data = path.read_bytes()
        actual[name] = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
missing = sorted(set(expected) - set(actual))
untracked = sorted(set(actual) - set(expected))
changed = sorted(name for name in set(expected) & set(actual) if expected[name] != actual[name])
if missing or untracked or changed:
    raise RuntimeError('Production differs from selected APK source: ' + json.dumps({'missing': missing, 'untracked': untracked, 'changed': changed}))
case.mkdir(parents=True, exist_ok=True)
case.chmod(0o700)
proof = case / ('source-' + sha[:12] + '.json')
proof.write_text(json.dumps({'commit': sha, 'files': actual}))
proof.chmod(0o600)
for path, method, data, expected_status in [('/health', 'GET', None, 200), ('/ahmed/session', 'POST', b'{}', 422), ('/sms/messages/1/review', 'GET', None, 401), ('/sms/messages/1/investment/uploaded', 'POST', b'{}', 401)]:
    request = urllib.request.Request('https://ahmed.pm.sa/api' + path, data=data, method=method, headers={'Accept': 'application/json', 'Content-Type': 'application/json'})
    try: response = urllib.request.urlopen(request, timeout=25)
    except urllib.error.HTTPError as error: response = error
    assert response.code == expected_status and 'application/json' in response.headers.get('Content-Type', ''), 'API verification failed: ' + path
print('LATEST_APK_COMPLETE_LIVE_SOURCE_AND_API_VERIFIED files=' + str(len(actual)) + ' commit=' + sha, flush=True)
