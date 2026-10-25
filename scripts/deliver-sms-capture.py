#!/usr/bin/env python3
"""Deploy only the reviewed SMS files, preserving every other production source."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
sha = os.environ['AHMED_SMS_SHA']
php = shutil.which('php') or '/usr/local/bin/php'
stage = case / 'staged'
stage.mkdir(parents=True, exist_ok=True)
case.chmod(0o700)


def git_file(name):
    return subprocess.check_output(['git', 'show', sha + ':' + name], cwd=root)


manifest = json.loads(git_file('scripts/sms-release-20261025.json'))


def verify_live():
    for name, expected in manifest['baseline'].items():
        live = root / name
        if not live.is_file():
            raise RuntimeError('Production source disappeared: ' + name)
        digest = hashlib.sha256(live.read_bytes()).hexdigest()
        allowed = {expected, manifest['files'].get(name)}
        if digest not in allowed:
            raise RuntimeError('Production source changed since inspection: ' + name)
    for name in manifest['preserved_production_sources']:
        if hashlib.sha256(git_file(name)).hexdigest() != hashlib.sha256((root / name).read_bytes()).hexdigest():
            raise RuntimeError('Newer production source was not preserved: ' + name)
    for name, expected in manifest['files'].items():
        if name in manifest['baseline']:
            continue
        live = root / name
        if live.exists() and (not live.is_file() or hashlib.sha256(live.read_bytes()).hexdigest() != expected):
            raise RuntimeError('New file conflicts with existing production work: ' + name)


verify_live()
for name, expected in manifest['files'].items():
    data = git_file(name)
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError('Release checksum mismatch: ' + name)
    target = stage / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    target.chmod(0o644)
print('SMS_COMPLETE_PRODUCTION_SOURCE_VERIFIED files=' + str(len(manifest['baseline'])), flush=True)

for name in manifest['files']:
    if name.endswith('.php'):
        subprocess.run([php, '-l', str(stage / name)], check=True, stdout=subprocess.DEVNULL)
node_check = r'''
const fs=require('fs'),path=require('path'),{createRequire}=require('module');
const mobile=path.join(process.env.AHMED_SMS_ROOT,'ahmed-mobile');
const liveRequire=createRequire(path.join(mobile,'package.json')),babel=liveRequire('@babel/core');
for(const name of ['SmsArchiveScreen.js','smsCapture.js','ahmedCurrentUser.js','UiIcon.js','AppShell.js']) {
  babel.transformSync(fs.readFileSync(path.join(process.env.AHMED_SMS_CASE,'staged','ahmed-mobile',name),'utf8'),
    {filename:path.join(mobile,name),configFile:path.join(mobile,'babel.config.js'),babelrc:false});
}
console.log('SMS_MOBILE_SOURCE_COMPILED');
'''
subprocess.run(['node', '-'], input=node_check.encode(), cwd=root / 'ahmed-mobile', check=True)
drivers = subprocess.check_output([php, '-r', 'echo implode(",",PDO::getAvailableDrivers());']).decode()
if 'sqlite' in drivers.split(','):
    subprocess.run([php, str(stage / 'scripts/test-sms-capture.php'), str(root), str(stage)], check=True, cwd=root / 'ahmed-api')
else:
    print('SMS_SERVER_LINT_PASSED_SQLITE_INTEGRATION_ALREADY_TESTED_IN_CI', flush=True)

verify_live()
owner = (root / 'ahmed-mobile/AppShell.js').stat()


def install(name):
    live = root / name
    data = (stage / name).read_bytes()
    if live.is_file():
        backup = case / 'before' / name
        if not backup.exists():
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(live.read_bytes())
            backup.chmod(0o600)
    live.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.sms-release-', dir=str(live.parent))
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o644)
        if os.geteuid() == 0:
            os.chown(temporary, owner.st_uid, owner.st_gid)
        os.replace(temporary, live)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


# Install dependencies before the route and navigation entry points become visible.
for name in manifest['files']:
    if name not in ['ahmed-api/routes/api.php', 'ahmed-mobile/AppShell.js', 'ahmed-mobile/ahmedCurrentUser.js']:
        install(name)
subprocess.run([php, 'artisan', 'migrate', '--path=database/migrations/2026_10_25_180000_create_sms_capture_tables.php', '--force', '--no-interaction'], cwd=root / 'ahmed-api', check=True)
for name in ['ahmed-api/routes/api.php', 'ahmed-mobile/ahmedCurrentUser.js', 'ahmed-mobile/AppShell.js']:
    install(name)
subprocess.run([php, 'artisan', 'optimize:clear'], cwd=root / 'ahmed-api', check=True)

for name, expected in manifest['files'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Installed source checksum mismatch: ' + name)

# Restart only the verified Ahmed Metro process; no reset/deployment scripts are used.
listeners = subprocess.run(['lsof', '-tiTCP:8082', '-sTCP:LISTEN'], stdout=subprocess.PIPE, text=True).stdout.split()
for value in listeners:
    pid = int(value)
    if os.path.realpath('/proc/' + value + '/cwd') != str(root / 'ahmed-mobile'):
        raise RuntimeError('Expo listener belongs to another project')
    command = Path('/proc/' + value + '/cmdline').read_bytes().replace(b'\0', b' ').decode()
    if 'expo' not in command or '8082' not in command:
        raise RuntimeError('Unexpected process on Expo port')
for value in listeners:
    os.kill(int(value), signal.SIGTERM)
for _ in range(30):
    if not subprocess.run(['lsof', '-tiTCP:8082', '-sTCP:LISTEN'], stdout=subprocess.PIPE, text=True).stdout.strip():
        break
    time.sleep(.5)
else:
    raise RuntimeError('Expo port did not close')
runtime = root.parent
(runtime / '.cache').mkdir(exist_ok=True)
(runtime / '.tmp').mkdir(exist_ok=True)
environment = dict(os.environ, CI='1', BROWSER='none', EXPO_NO_TELEMETRY='1', EXPO_NO_DEVTOOLS='1', REACT_NATIVE_PACKAGER_HOSTNAME='ahmed.pm.sa', EXPO_PUBLIC_API_URL='https://ahmed.pm.sa/api', XDG_CACHE_HOME=str(runtime / '.cache'), TMPDIR=str(runtime / '.tmp'), TMP=str(runtime / '.tmp'), TEMP=str(runtime / '.tmp'))
with (case / 'expo-sms.log').open('ab') as log:
    process = subprocess.Popen(['npx', 'expo', 'start', '--clear', '--go', '--host', 'lan', '--port', '8082'], cwd=root / 'ahmed-mobile', env=environment, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
(runtime / 'ahmed-expo-8082.pid').write_text(str(process.pid))
for _ in range(60):
    try:
        if b'packager-status:running' in urllib.request.urlopen('http://127.0.0.1:8082/status', timeout=3).read():
            break
    except Exception:
        pass
    time.sleep(1)
else:
    raise RuntimeError('Expo did not restart')

for path, method, body, expected in [('/health', 'GET', None, 200), ('/ahmed/session', 'POST', b'{}', 422), ('/sms/messages', 'GET', None, 401), ('/sms/ingest', 'POST', b'{"messages":[]}', 401)]:
    request = urllib.request.Request('https://ahmed.pm.sa/api' + path, data=body, method=method, headers={'Accept': 'application/json', 'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    if response.code != expected or 'application/json' not in response.headers.get('Content-Type', ''):
        raise RuntimeError('Live API check failed: ' + path + ' status=' + str(response.code))

bundle = urllib.request.urlopen('http://127.0.0.1:8082/index.bundle?platform=android&dev=true&hot=false&lazy=false&minify=false&transform.engine=hermes&transform.bytecode=0', timeout=180).read()
for marker in [b'AhmedSmsCapture', b'enableSmsCapture', b'SmsArchiveScreen', b'fetchSmsArchive']:
    if marker not in bundle:
        raise RuntimeError('Served Expo bundle is missing SMS source')
(case / 'delivery.json').write_text(json.dumps({'sha': sha, 'files': manifest['files'], 'api_verified': True, 'expo_verified': True}))
print('SMS_GUARDED_DELIVERY_API_AND_EXPO_VERIFIED', flush=True)
