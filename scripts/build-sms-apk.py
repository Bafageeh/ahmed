#!/usr/bin/env python3
"""Build the installed app with its existing signing credentials and publish its APK."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.error
import urllib.request
import zipfile

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
mobile = root / 'ahmed-mobile'
release = json.loads((case / 'delivery.json').read_text())
if release['sha'] != os.environ['AHMED_SMS_SHA']:
    raise RuntimeError('APK source was not verified by this delivery')
for name, expected in release['files'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Source changed before APK build: ' + name)
if not (mobile / 'credentials.json').is_file():
    raise RuntimeError('The apk profile requires the existing local signing credentials')
environment = dict(os.environ, CI='1', EXPO_NO_TELEMETRY='1', EAS_NO_VCS='1', EXPO_PUBLIC_API_URL='https://ahmed.pm.sa/api')
print('SMS_SIGNED_ANDROID_APK_BUILD_STARTED', flush=True)
with (case / 'apk-build.json').open('wb') as output, (case / 'apk-build.log').open('wb') as log:
    result = subprocess.run(['npx', 'eas-cli', 'build', '--platform', 'android', '--profile', 'apk', '--non-interactive', '--wait', '--json'], cwd=mobile, env=environment, stdout=output, stderr=log)
if result.returncode:
    # Keep credentials and full build output in the private case directory.
    import re
    for line in (case / 'apk-build.log').read_text(errors='replace').splitlines()[-45:]:
        if not re.search(r'token|password|secret|credential', line, re.I):
            print(line)
    raise RuntimeError('EAS Android build failed; inspect the private build log')
builds = json.loads((case / 'apk-build.json').read_text())
build = builds[0] if isinstance(builds, list) else builds
if build.get('status') != 'FINISHED':
    raise RuntimeError('APK build did not finish successfully')
url = build.get('artifacts', {}).get('buildUrl') or build.get('artifacts', {}).get('applicationArchiveUrl')
if not url or not url.startswith('https://'):
    raise RuntimeError('Finished build did not provide an HTTPS APK artifact')
download = case / 'ahmed-sms-1.0.22.apk'
with urllib.request.urlopen(url, timeout=180) as response, download.open('wb') as output:
    shutil.copyfileobj(response, output)
with zipfile.ZipFile(download) as archive:
    manifest = archive.read('AndroidManifest.xml')
    # Android binary XML string pools may use UTF-8 or UTF-16 strings.
    for marker in ['android.permission.RECEIVE_SMS', 'expo.modules.ahmedsmscapture.IncomingSmsReceiver', 'expo.modules.ahmedsmscapture.SmsUploadJob']:
        if marker.encode() not in manifest and marker.encode('utf-16le') not in manifest:
            raise RuntimeError('APK does not contain the required SMS manifest entry: ' + marker)
    if b'android.permission.READ_SMS' in manifest or 'android.permission.READ_SMS'.encode('utf-16le') in manifest:
        raise RuntimeError('New-message capture must not request historical inbox access')
public_url = 'https://ahmed.pm.sa/downloads/ahmed-sms-1.0.22.apk'
published = None
for public in [root / 'public', root / 'ahmed-api/public']:
    destination = public / 'downloads/ahmed-sms-1.0.22.apk'
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(download, destination)
    destination.chmod(0o644)
    try:
        request = urllib.request.Request(public_url, method='HEAD', headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.code == 200 and int(response.headers.get('Content-Length', 0)) == download.stat().st_size:
                published = destination
                break
    except (urllib.error.HTTPError, urllib.error.URLError):
        pass
    destination.unlink()
if published is None:
    raise RuntimeError('APK built successfully but its public download URL could not be verified')
result = {'build_id': build['id'], 'url': public_url, 'sha256': hashlib.sha256(download.read_bytes()).hexdigest(), 'bytes': download.stat().st_size, 'version': '1.0.22'}
(case / 'apk-result.json').write_text(json.dumps(result))
print('SMS_APK_READY ' + json.dumps(result), flush=True)
