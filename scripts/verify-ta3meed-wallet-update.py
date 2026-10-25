#!/usr/bin/env python3
"""Verify the published native update through the authenticated EAS management API."""
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(os.environ['AHMED_SMS_ROOT']).resolve()
case = Path(os.environ['AHMED_SMS_CASE']).resolve()
mobile = root / 'ahmed-mobile'
updates = json.loads((case / 'native-wallet-update.json').read_text())
assert {item['platform'] for item in updates} == {'android', 'ios'}
assert all(item['runtimeVersion'] == '1.0.23' for item in updates)
group = updates[0].get('group') or updates[0].get('groupId')
assert isinstance(group, str) and re.fullmatch(r'[0-9a-f-]{36}', group, re.I), 'Update group unavailable'
environment = dict(os.environ, CI='1', EXPO_NO_TELEMETRY='1')


def inspect(args, name):
    with (case / (name + '.json')).open('wb') as out, (case / (name + '.log')).open('wb') as log:
        result = subprocess.run(['npx', 'eas-cli'] + args + ['--json'], cwd=mobile, env=environment, stdout=out, stderr=log, timeout=120)
    if result.returncode:
        raise RuntimeError('Authenticated EAS inspection failed: ' + name)
    return json.loads((case / (name + '.json')).read_text())


channel = inspect(['channel:view', 'production'], 'wallet-production-channel')
group_view = inspect(['update:view', group], 'wallet-published-group')
serialized_group = json.dumps(group_view)
assert all(item['id'] in serialized_group for item in updates), 'Published platform update not found in the update group'
assert channel.get('name') == 'production' and not channel.get('isPaused', False), 'Production channel is unavailable'


def walk(value):
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from walk(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk(nested)


branch_ids = set()
branch_names = set()
for node in walk(group_view):
    branch = node.get('branch') or node.get('updateBranch')
    if isinstance(branch, dict):
        if branch.get('id'): branch_ids.add(branch['id'])
        if branch.get('name'): branch_names.add(branch['name'])
    elif isinstance(branch, str):
        branch_names.add(branch)
    if isinstance(node.get('branchId'), str): branch_ids.add(node['branchId'])
serialized_channel = json.dumps(channel)
same_updates = any(item['id'] in serialized_channel for item in updates) or group in serialized_channel
same_branch = any(value in serialized_channel for value in branch_ids)
if not same_branch and branch_names:
    active_branches = channel.get('updateBranches') or channel.get('branches') or []
    same_branch = bool(branch_names.intersection(node.get('name') for node in walk(active_branches)))
assert same_updates or same_branch, 'Production channel does not reference the published wallet branch'
result = {'web_url': 'https://ahmed.pm.sa/webapp/', 'runtime': '1.0.23', 'production_channel_verified': True,
          'group': group, 'updates': [{'id': item['id'], 'platform': item['platform']} for item in updates],
          'source_commit': '3f253cb8c1ff0fcba3d3bd33ab19330b6a7f015d'}
(case / 'wallet-publication.json').write_text(json.dumps(result))
print('TA3MEED_WALLET_PRODUCTION_CHANNEL_AND_UPDATES_VERIFIED ' + json.dumps(result), flush=True)
