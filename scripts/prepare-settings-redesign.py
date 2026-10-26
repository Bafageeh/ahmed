#!/usr/bin/env python3
"""Verify full source and prepare an isolated render; production files are never replaced."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import secrets
import shutil

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
sha = os.environ['AHMED_SMS_SHA']
read = lambda name: subprocess.check_output(['git', 'show', sha + ':' + name], cwd=root)
manifest = json.loads(read('scripts/settings-redesign-release-20261026.json'))
for name, digest in manifest['baseline'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() in {digest, manifest['files'].get(name)}, 'Production changed: ' + name
    assert hashlib.sha256(read(name)).hexdigest() == manifest['files'].get(name, digest), 'Reviewed source missing: ' + name
case.mkdir(parents=True, exist_ok=True)
case.chmod(0o700)
stage = case / 'staged'
for name in set(manifest['baseline']) | set(manifest['files']):
    if not name.startswith('ahmed-mobile/') or not (name.endswith('.js') or name == 'ahmed-mobile/package.json'):
        continue
    target = stage / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(read(name))
    target.chmod(0o644)
modules = stage / 'ahmed-mobile/node_modules'
if not modules.exists():
    modules.symlink_to(root / 'ahmed-mobile/node_modules', target_is_directory=True)
(case / 'settings-release.json').write_text(json.dumps(manifest))
(case / 'settings-release.json').chmod(0o600)
test = case / 'check-settings-redesign.cjs'
test.write_bytes(read('scripts/check-settings-redesign.cjs'))
subprocess.run(['node', str(test)], cwd=root / 'ahmed-mobile', check=True, timeout=180)
previews = []
for mode in ['admin', 'user']:
    relative = Path('qa') / ('settings-' + secrets.token_hex(10) + '-' + mode + '.html')
    html = (case / ('settings-' + mode + '-preview.html')).read_text()
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; font-src &#39;self&#39;">')
    for base in [root / 'ahmed-api/public/webapp', root / 'ahmed-mobile/dist-web']:
        destination = base / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.parent.chmod(0o755)
        destination.write_text(html)
        destination.chmod(0o644)
    previews.append({'mode': mode, 'path': str(relative), 'sha256': hashlib.sha256(html.encode()).hexdigest()})
    print('SETTINGS_PREVIEW_URL ' + mode + ' https://ahmed.pm.sa/webapp/' + str(relative), flush=True)
proof = json.loads((case / 'settings-qa.json').read_text())
proof['previews'] = previews
(case / 'settings-qa.json').write_text(json.dumps(proof))
