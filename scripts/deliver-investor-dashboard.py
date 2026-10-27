#!/usr/bin/env python3
"""Publish the reviewed investor dashboard while preserving financial records and all other source."""
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


manifest = json.loads(git_file(os.environ['AHMED_UI_RELEASE_MANIFEST']))
assert set(manifest['files']) == set(['ahmed-mobile/ta3meed/Ta3meedInvestorDashboard.js', 'ahmed-mobile/ta3meed/Ta3meedTenantInvestorAccounts.js']), 'Unexpected investor dashboard release scope'


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


def verify_inventory():
    excluded={'.git','node_modules','.expo','build','.gradle','dist-web','dist','apk','build-output','Pods','vendor','cache'}
    extensions={'.js','.jsx','.ts','.tsx','.json','.kt','.java','.xml','.gradle','.kts','.php','.png','.jpg','.jpeg','.webp','.svg','.gif','.ttf','.otf'}
    sources=['ahmed-mobile','ahmed-api/app','ahmed-api/routes','ahmed-api/bootstrap','ahmed-api/config','ahmed-api/database/migrations','ahmed-api/tests']
    current=set()
    for base in sources:
        for p in (root/base).rglob('*'):
            rel=p.relative_to(root)
            if not p.is_file() or p.is_symlink() or any(part in excluded for part in rel.parts) or p.suffix not in extensions:continue
            if p.name.startswith('.') or any(x in p.name.lower() for x in ['credential','private-key','google-services','service-account']):continue
            if p.stat().st_size<=3000000:current.add(str(rel))
    expected=set(manifest['baseline'])
    assert expected <= current, 'A production source disappeared'
    assert current <= expected | set(manifest['files']), 'Unreviewed production sources: '+repr(sorted(current-expected-set(manifest['files'])))

verify_inventory()
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
for(const name of JSON.parse(process.env.AHMED_UI_COMPILE_FILES)) {
  babel.transformSync(fs.readFileSync(path.join(process.env.AHMED_SMS_CASE,'staged','ahmed-mobile',name),'utf8'),
    {filename:path.join(mobile,name),configFile:path.join(mobile,'babel.config.js'),babelrc:false});
}
console.log('TA3MEED_SMS_MOBILE_SOURCE_COMPILED');
'''
compile_files = [name[len('ahmed-mobile/'):] for name in manifest['files'] if name.startswith('ahmed-mobile/') and name.endswith('.js')]
subprocess.run(['node', '-'], input=node_check.encode(), cwd=root / 'ahmed-mobile', env=dict(os.environ, AHMED_UI_COMPILE_FILES=json.dumps(compile_files)), check=True)
proof=json.loads((case/'investor-dashboard-qa.json').read_text())
assert proof['passed'] and proof['files']==manifest['files'], 'Reviewed dashboard source differs from release'
assert proof['test_sha256']==hashlib.sha256(git_file('scripts/check-investor-dashboard.cjs')).hexdigest(), 'Reviewed UI checks differ'
assert proof['source_commit']==manifest['ui_verified_commit'] and proof['checks']>=17, 'Actual dashboard checks must match the reviewed commit'
print('INVESTOR_DASHBOARD_SOURCE_AND_BEHAVIOR_VERIFIED checks='+str(proof['checks']),flush=True)


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


# Only the two reviewed dashboard sources are replaced.
for name in manifest['files']:
    install(name)
verify_live()

for name, expected in manifest['files'].items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Installed source checksum mismatch: ' + name)

# Restart only the verified Ahmed Metro process; no reset/deployment scripts are used.
listeners = subprocess.run(['lsof', '-tiTCP:8082', '-sTCP:LISTEN'], stdout=subprocess.PIPE, universal_newlines=True).stdout.split()
owned = bool(listeners)
for value in listeners:
    try:
        same_project = os.path.samefile('/proc/' + value + '/cwd', root / 'ahmed-mobile')
        command = Path('/proc/' + value + '/cmdline').read_bytes().replace(b'\0', b' ').decode()
        owned = owned and same_project and 'expo' in command and '8082' in command
    except OSError:
        owned = False
if owned or not listeners:
    for value in listeners:
        os.kill(int(value), signal.SIGTERM)
    for _ in range(30):
        if not subprocess.run(['lsof', '-tiTCP:8082', '-sTCP:LISTEN'], stdout=subprocess.PIPE, universal_newlines=True).stdout.strip():
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
else:
    # A process outside this SSH user's visible namespace must be left alone.
    # Existing Metro can serve the changed files; verify its actual bundle below.
    print('SMS_EXISTING_EXPO_LISTENER_PRESERVED_AND_BUNDLE_WILL_BE_VERIFIED', flush=True)
for _ in range(60):
    try:
        if b'packager-status:running' in urllib.request.urlopen('http://127.0.0.1:8082/status', timeout=3).read():
            break
    except Exception:
        pass
    time.sleep(1)
else:
    raise RuntimeError('Expo did not restart')

for path, method, body, expected in [('/health', 'GET', None, 200), ('/ahmed/session', 'POST', b'{}', 422), ('/ta3meed/wallet', 'GET', None, 401), ('/sms/ingest', 'POST', b'{"messages":[]}', 401), ('/sms/messages/1/approve', 'POST', b'{}', 401), ('/sms/messages/1/review', 'GET', None, 401), ('/sms/messages/1/investment', 'GET', None, 401), ('/sms/messages/1/investment/complete', 'POST', b'{}', 401), ('/sms/messages/1/investment/dismiss', 'POST', b'{}', 401), ('/sms/messages/1/investment/uploaded', 'POST', b'{}', 401)]:
    request = urllib.request.Request('https://ahmed.pm.sa/api' + path, data=body, method=method, headers={'Accept': 'application/json', 'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(request, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    if response.code != expected or 'application/json' not in response.headers.get('Content-Type', ''):
        raise RuntimeError('Live API check failed: ' + path + ' status=' + str(response.code))

bundle = urllib.request.urlopen('http://127.0.0.1:8082/index.bundle?platform=android&dev=true&hot=false&lazy=false&minify=false&transform.engine=hermes&transform.bytecode=0', timeout=180).read()
for marker in [b'ta3meed-wallet-safe-header', b'mark-sms-investment-uploaded', manifest['bundle_marker'].encode()]:
    if marker not in bundle:
        raise RuntimeError('Served Expo bundle is missing SMS source')
(case / 'delivery.json').write_text(json.dumps({'sha': sha, 'files': manifest['files'], 'api_verified': True, 'expo_verified': True, 'bundle_marker': manifest['bundle_marker'], 'update_message': manifest['update_message']}))
print('INVESTOR_DASHBOARD_API_AND_EXPO_VERIFIED', flush=True)
