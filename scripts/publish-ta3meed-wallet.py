#!/usr/bin/env python3
"""Publish verified wallet JavaScript to web and the existing native runtime; no APK rebuild."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from email import policy
from email.parser import BytesParser

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
sha = os.environ['AHMED_SMS_SHA']
mobile = root / 'ahmed-mobile'
assert json.loads((case / 'delivery.json').read_text())['sha'] == sha
config = json.loads((mobile / 'app.json').read_text())['expo']
assert config['version'] == '1.0.23', 'The installed native runtime must not be changed for a JavaScript-only update'
environment = dict(os.environ, CI='1', EAS_NO_VCS='1', EXPO_NO_TELEMETRY='1', EXPO_PUBLIC_API_URL='https://ahmed.pm.sa/api')
environment['XDG_CACHE_HOME'] = str(root.parent / '.cache')
environment['TMPDIR'] = str(root.parent / '.tmp')
for name in ['XDG_CACHE_HOME', 'TMPDIR']:
    Path(environment[name]).mkdir(exist_ok=True)


def command(args, log_name, output_name=None):
    with (case / log_name).open('wb') as log:
        if output_name:
            with (case / output_name).open('wb') as output:
                result = subprocess.run(args, cwd=mobile, env=environment, stdout=output, stderr=log, timeout=900)
        else:
            result = subprocess.run(args, cwd=mobile, env=environment, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    if result.returncode:
        for line in (case / log_name).read_text(errors='replace').splitlines()[-35:]:
            if not re.search(r'token|password|secret|credential', line, re.I):
                print(line, flush=True)
        raise RuntimeError('Publication command failed; private log: ' + log_name)


def fetch(url, headers=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=45) as response:
        body = response.read()
        if response.headers.get('Content-Encoding') == 'gzip':
            body = gzip.decompress(body)
        return body, response.headers


build = case / ('wallet-web-' + sha[:12])
command(['npx', 'expo', 'export', '--platform', 'web', '--output-dir', str(build)], 'web-export.log')
html = (build / 'index.html').read_text()
for attr in ['src', 'href']:
    for prefix in ['/_expo/', '/assets/']:
        html = html.replace(attr + '="' + prefix, attr + '="/webapp' + prefix)
for destination in [mobile / 'dist-web', root / 'ahmed-api/public/webapp']:
    destination.mkdir(parents=True, exist_ok=True)
    destination.chmod(0o755)
    for source in build.rglob('*'):
        if not source.is_file() or source.relative_to(build) == Path('index.html'):
            continue
        target = destination / source.relative_to(build)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        target.chmod(0o644)
        parent = target.parent
        while parent != destination:
            parent.chmod(0o755)
            parent = parent.parent
    previous = case / ('before-wallet-' + destination.parent.name + '-index.html')
    if (destination / 'index.html').exists() and not previous.exists():
        previous.write_bytes((destination / 'index.html').read_bytes())
        previous.chmod(0o600)
    fd, temporary = tempfile.mkstemp(prefix='.wallet-index-', dir=destination)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(html.encode())
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o644)
    os.replace(temporary, destination / 'index.html')

scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
assert scripts, 'Web export did not produce scripts'
verified = False
for src in scripts:
    if '/_expo/' not in src:
        continue
    url = 'https://ahmed.pm.sa' + src if src.startswith('/') else 'https://ahmed.pm.sa/webapp/' + src
    served, _ = fetch(url, {'Cache-Control': 'no-cache'})
    local = root / 'ahmed-api/public' / src.lstrip('/') if src.startswith('/') else root / 'ahmed-api/public/webapp' / src
    assert hashlib.sha256(served).hexdigest() == hashlib.sha256(local.read_bytes()).hexdigest(), 'Served web bundle differs from the reviewed source'
    if b'ta3meed-cash-wallet' in served:
        verified = True
assert verified, 'The served web bundle is missing the wallet screen'
print('TA3MEED_WALLET_SERVED_WEB_VERIFIED https://ahmed.pm.sa/webapp/', flush=True)

command(['npx', 'eas-cli', 'update', '--channel', 'production', '--platform', 'all', '--environment', 'production',
         '--message', 'Ta3meed wallet: manual and SMS cash movements ' + sha[:12], '--non-interactive', '--json'],
        'native-wallet-update.log', 'native-wallet-update.json')
updates = json.loads((case / 'native-wallet-update.json').read_text())
assert isinstance(updates, list) and {item['platform'] for item in updates} == {'ios', 'android'}
assert all(item['runtimeVersion'] == '1.0.23' for item in updates), 'Unexpected native runtime'
android = next(item for item in updates if item['platform'] == 'android')
project_id = config['extra']['eas']['projectId']
manifest_headers = {'expo-platform': 'android', 'expo-runtime-version': '1.0.23', 'expo-channel-name': 'production',
                    'expo-protocol-version': '1', 'Accept': 'application/expo+json,application/json,multipart/mixed', 'Cache-Control': 'no-cache'}
manifest = None
for attempt in range(5):
    try:
        body, headers = fetch('https://u.expo.dev/' + project_id, manifest_headers)
        if 'multipart/' in headers.get('Content-Type', ''):
            message = BytesParser(policy=policy.default).parsebytes(('Content-Type: ' + headers['Content-Type'] + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + body)
            parts = [part.get_payload(decode=True) for part in message.iter_parts() if part.get_param('name', header='content-disposition') == 'manifest']
            assert len(parts) == 1
            manifest = json.loads(parts[0])
        else:
            manifest = json.loads(body)
        assert manifest['id'].replace('-', '').lower() == android['id'].replace('-', '').lower()
        launch, _ = fetch(manifest['launchAsset']['url'])
        assert b'ta3meed-cash-wallet' in launch, 'Native update asset is missing the wallet screen'
        break
    except Exception:
        if attempt == 4:
            raise
        time.sleep(12)
result = {'source_commit': sha, 'web_url': 'https://ahmed.pm.sa/webapp/', 'runtime': '1.0.23',
          'updates': [{'id': item['id'], 'platform': item['platform'], 'group': item.get('group')} for item in updates],
          'android_manifest_verified': True}
(case / 'wallet-publication.json').write_text(json.dumps(result))
print('TA3MEED_WALLET_WEB_AND_INSTALLED_APP_UPDATE_VERIFIED ' + json.dumps(result), flush=True)
