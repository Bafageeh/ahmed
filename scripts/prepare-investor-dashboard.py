#!/usr/bin/env python3
"""Stage the reviewed UI against the full live source inventory, without changing production."""
import hashlib,json,os,subprocess
from pathlib import Path
root=Path(os.environ['AHMED_SMS_ROOT']).resolve()
case=Path(os.environ['AHMED_SMS_CASE']).resolve()
sha=os.environ['AHMED_SMS_SHA']
read=lambda name: subprocess.check_output(['git','show',sha+':'+name],cwd=root)
manifest=json.loads(read('scripts/investor-dashboard-release-20261027.json'))
for name,digest in manifest['baseline'].items():
 assert hashlib.sha256((root/name).read_bytes()).hexdigest() in {digest,manifest['files'].get(name)}, 'Production changed: '+name
 assert hashlib.sha256(read(name)).hexdigest()==manifest['files'].get(name,digest), 'Complete current source missing from selected commit: '+name
case.mkdir(parents=True,exist_ok=True);case.chmod(0o700)
for name,digest in manifest['files'].items():
 data=read(name)
 assert hashlib.sha256(data).hexdigest()==digest
 target=case/'staged'/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);target.chmod(0o644)
test=case/'check-investor-dashboard.cjs';test.write_bytes(read('scripts/check-investor-dashboard.cjs'))
subprocess.run(['node',str(test)],cwd=root/'ahmed-mobile',check=True,timeout=180)
p=case/'investor-dashboard-qa.json';proof=json.loads(p.read_text());proof.update(files=manifest['files'],test_sha256=hashlib.sha256(test.read_bytes()).hexdigest());p.write_text(json.dumps(proof))
print('INVESTOR_DASHBOARD_STAGING_VERIFIED current_sources='+str(len(manifest['baseline'])),flush=True)
