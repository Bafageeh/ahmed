#!/usr/bin/env python3
"""Stage and exercise the existing add form and SMS actions without replacing production files."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
sha = os.environ['AHMED_SMS_SHA']
read = lambda name: subprocess.check_output(['git', 'show', sha + ':' + name], cwd=root)
manifest = json.loads(read('scripts/investment-sms-release-20261026.json'))
for name, digest in manifest['baseline'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() in {digest, manifest['files'].get(name)}, 'Production changed: ' + name
    assert hashlib.sha256(read(name)).hexdigest() == manifest['files'].get(name, digest), 'Complete production source missing in selected commit: ' + name
case.mkdir(parents=True, exist_ok=True)
case.chmod(0o700)
for name, digest in manifest['files'].items():
    data = read(name)
    assert hashlib.sha256(data).hexdigest() == digest, 'Staged checksum differs: ' + name
    target = case / 'staged' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    target.chmod(0o644)
test = case / 'check-sms-investment.cjs'
test.write_bytes(read('scripts/check-sms-investment.cjs'))
subprocess.run(['node', str(test)], cwd=root / 'ahmed-mobile', check=True, timeout=180)
proof = json.loads((case / 'investment-qa.json').read_text())
proof['files'] = manifest['files']
proof['test_sha256'] = hashlib.sha256(test.read_bytes()).hexdigest()
(case / 'investment-qa.json').write_text(json.dumps(proof))
print('SMS_INVESTMENT_STAGED_SOURCE_AND_EXISTING_FORM_VERIFIED', flush=True)
