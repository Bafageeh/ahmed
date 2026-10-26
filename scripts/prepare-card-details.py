#!/usr/bin/env python3
"""Stage and render actual opportunity cards without changing financial data or production sources."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
sha = os.environ['AHMED_SMS_SHA']
read = lambda name: subprocess.check_output(['git', 'show', sha + ':' + name], cwd=root)
manifest = json.loads(read('scripts/card-details-release-20261026.json'))
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
test = case / 'check-ta3meed-card-details.cjs'
test.write_bytes(read('scripts/check-ta3meed-card-details.cjs'))
subprocess.run(['node', str(test)], cwd=root / 'ahmed-mobile', check=True, timeout=180)
proof = json.loads((case / 'card-details-qa.json').read_text())
proof['files'] = manifest['files']
proof['test_sha256'] = hashlib.sha256(test.read_bytes()).hexdigest()
(case / 'card-details-qa.json').write_text(json.dumps(proof))
print('TA3MEED_CARD_DETAILS_STAGED_UI_VERIFIED', flush=True)

# Public review pages contain synthetic fixtures only and are removed after visual QA.
import secrets, shutil
public = root / 'ahmed-api/public/webapp'
secret_file = case / 'preview-token'
if not secret_file.exists():
    secret_file.write_text(secrets.token_hex(12)); secret_file.chmod(0o600)
token = secret_file.read_text().strip()
assert len(token) == 24 and all(x in '0123456789abcdef' for x in token)
preview = public / ('_card-review-' + token)
assert preview.parent.resolve() == public.resolve() and not preview.is_symlink()
preview.mkdir(exist_ok=True); preview.chmod(0o755)
for width in [390,320]:
    name = 'card-details-' + str(width) + '.html'
    shutil.copyfile(case / name, preview / name); (preview / name).chmod(0o644)
    print('CARD_DETAILS_REVIEW_URL https://ahmed.pm.sa/webapp/' + preview.name + '/' + name, flush=True)
