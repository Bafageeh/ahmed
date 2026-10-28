#!/usr/bin/env python3
"""Install two verified backend files; preserve the full production tree and all financial data."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.request

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
sha = os.environ['AHMED_SMS_SHA']
php = shutil.which('php') or '/usr/local/bin/php'
case.mkdir(parents=True, exist_ok=True)
case.chmod(0o700)
read = lambda name: subprocess.check_output(['git', 'show', sha + ':' + name], cwd=root)
manifest = json.loads(read('scripts/partial-repayment-sms-release-20261028.json'))
allowed = {'ahmed-api/app/Support/Ta3meedSmsParser.php',
    'ahmed-api/app/Http/Controllers/Api/Ta3meedReceiptController.php'}
assert set(manifest['files']) == allowed, 'Unexpected partial-repayment release scope'
excluded = {'.git', 'node_modules', '.expo', 'build', '.gradle', 'dist-web', 'dist', 'apk', 'build-output', 'Pods', 'vendor', 'cache'}
extensions = {'.js', '.jsx', '.ts', '.tsx', '.json', '.kt', '.java', '.xml', '.gradle', '.kts', '.php', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ttf', '.otf'}
sources = ['ahmed-mobile', 'ahmed-api/app', 'ahmed-api/routes', 'ahmed-api/bootstrap',
    'ahmed-api/config', 'ahmed-api/database/migrations', 'ahmed-api/tests']


def included(name):
    p = Path(name)
    return (any(name.startswith(base + '/') for base in sources) and p.suffix in extensions
        and not any(part in excluded for part in p.parts) and not p.name.startswith('.')
        and not any(word in p.name.lower() for word in ['credential', 'private-key', 'google-services', 'service-account']))


def tracked(commit):
    result = {}
    for line in subprocess.check_output(['git', 'ls-tree', '-r', commit], cwd=root).decode().splitlines():
        metadata, name = line.split('\t', 1)
        if included(name): result[name] = metadata.split()[2]
    return result


baseline = tracked(manifest['baseline_commit'])
desired = tracked(sha)
assert set(baseline) == set(desired), 'Runtime inventory changed'
assert {name for name in desired if desired[name] != baseline[name]} == allowed, 'Runtime changes exceed the reviewed scope'


def verify_live(allow_baseline):
    actual = {}
    for base in sources:
        for p in (root / base).rglob('*'):
            name = str(p.relative_to(root))
            if not included(name) or not p.is_file() or p.is_symlink(): continue
            data = p.read_bytes()
            actual[name] = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    assert set(actual) == set(desired), 'Production runtime inventory differs: ' + repr(sorted(set(actual) ^ set(desired)))
    for name, digest in actual.items():
        accepted = {desired[name]}
        if allow_baseline and name in allowed: accepted.add(baseline[name])
        assert digest in accepted, 'Production source changed since review: ' + name


verify_live(True)
print('PARTIAL_SMS_COMPLETE_PRODUCTION_SOURCE_VERIFIED files=' + str(len(desired)), flush=True)
stage = case / 'staged'
for name, digest in manifest['files'].items():
    data = read(name)
    assert hashlib.sha256(data).hexdigest() == digest, 'Staged checksum mismatch: ' + name
    target = stage / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    target.chmod(0o644)
    subprocess.run([php, '-l', str(target)], check=True)

# Execute these exact staged classes with the installed Laravel dependencies.
# All test database connections are explicitly isolated in SQLite memory.
tests = ['test-sms-capture.php', 'test-ta3meed-wallet.php', 'test-sms-review.php',
    'test-sms-review-prefill.php', 'test-sms-investment.php',
    'test-sms-investment-funding.php', 'test-partial-repayment-sms.php']
test_dir = stage / 'checks'
test_dir.mkdir(parents=True, exist_ok=True)
for name in tests: (test_dir / name).write_bytes(read('scripts/' + name))
bootstrap = stage / 'check-staged.php'
bootstrap.write_text("<?php\nrequire " + json.dumps(str(root / 'ahmed-api/vendor/autoload.php')) + ";\n"
    + ''.join('require ' + json.dumps(str(stage / name)) + ";\n" for name in sorted(allowed))
    + 'require ' + json.dumps(str(test_dir / 'test-partial-repayment-sms.php')) + ";\n")
environment = dict(os.environ, APP_ENV='testing', CACHE_STORE='array', SESSION_DRIVER='array',
    DB_CONNECTION='sqlite', DB_DATABASE=':memory:')
result = subprocess.run([php, str(bootstrap), str(root)], cwd=root, env=environment,
    check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
output = result.stdout.decode()
assert 'PARTIAL_REPAYMENT_SMS_INTEGRATION_PASSED ' in output, 'Staged integration suite did not complete'
print(output, end='', flush=True)

# Check again after staging and tests, then replace only the approved PHP files.
verify_live(True)
for name in sorted(allowed):
    live = root / name
    backup = case / 'before' / name
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        backup.write_bytes(live.read_bytes())
        backup.chmod(0o600)
    owner = live.stat()
    data = (stage / name).read_bytes()
    fd, temporary = tempfile.mkstemp(prefix='.partial-sms-', dir=live.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o644)
        if os.geteuid() == 0: os.chown(temporary, owner.st_uid, owner.st_gid)
        verify_live(True)
        os.replace(temporary, live)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

verify_live(False)
subprocess.run([php, 'artisan', 'optimize:clear', '--no-interaction'], cwd=root / 'ahmed-api', check=True)
for path, method, data, expected in [('/health', 'GET', None, 200),
    ('/ahmed/session', 'POST', b'{}', 422), ('/sms/messages', 'GET', None, 401),
    ('/sms/ingest', 'POST', b'{"messages":[]}', 401), ('/ta3meed/wallet', 'GET', None, 401)]:
    request = urllib.request.Request('https://ahmed.pm.sa/api' + path, data=data, method=method,
        headers={'Accept': 'application/json', 'Content-Type': 'application/json'})
    try: response = urllib.request.urlopen(request, timeout=25)
    except urllib.error.HTTPError as error: response = error
    assert response.code == expected and 'application/json' in response.headers.get('Content-Type', ''), 'Live API check failed: ' + path

(case / 'delivery.json').write_text(json.dumps({'sha': sha, 'files': manifest['files'],
    'complete_source_verified': True, 'staged_integration_passed': True, 'api_verified': True}))
print('PARTIAL_REPAYMENT_SMS_PRODUCTION_VERIFIED commit=' + sha + ' files=' + str(len(allowed)), flush=True)
