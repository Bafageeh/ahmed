#!/usr/bin/env python3
"""Inspect the signed build itself, resolving the manifest's actual runtime resource."""
import hashlib
import argparse
import json
from pathlib import Path
import re
import sys
import zipfile
from loguru import logger
logger.disable('androguard')
from androguard.core.apk import APK

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('path', type=Path)
parser.add_argument('expected_sha256', nargs='?')
parser.add_argument('--version-code', type=int, default=27)
parser.add_argument('--require-investment-funding', action='store_true')
args = parser.parse_args()
path = args.path
expected = args.expected_sha256
digest = hashlib.sha256(path.read_bytes()).hexdigest()
if expected: assert digest == expected, 'APK differs from the inspected build candidate'
apk = APK(str(path))
assert apk.get_package() == 'sa.pm.ahmed'
assert apk.get_androidversion_code() == str(args.version_code) and apk.get_androidversion_name() == '1.0.23'
namespace = '{http://schemas.android.com/apk/res/android}'
metadata = [node for node in apk.get_android_manifest_xml().iter('meta-data') if node.get(namespace + 'name') == 'expo.modules.updates.EXPO_RUNTIME_VERSION']
assert len(metadata) == 1, 'Expected one native update runtime setting'
value = metadata[0].get(namespace + 'value')
resolved = apk.get_android_resources().get_resolved_res_configs(int(value.lstrip('@'), 16)) if value.startswith('@') else [(None, value)]
assert resolved and all(runtime == '1.0.23' for _, runtime in resolved), 'Unexpected OTA runtime'
permissions = apk.get_permissions()
assert 'android.permission.RECEIVE_SMS' in permissions and 'android.permission.POST_NOTIFICATIONS' in permissions
assert 'android.permission.READ_SMS' not in permissions, 'Inbox-history access is forbidden'
manifest = apk.get_android_manifest_xml()
manifest_text = __import__('lxml.etree', fromlist=['tostring']).tostring(manifest).decode()
for entry in ['expo.modules.ahmedsmscapture.IncomingSmsReceiver', 'expo.modules.ahmedsmscapture.SmsUploadJob', 'ExpectedIncomeWidgetProvider']:
    assert entry in manifest_text, 'Required native feature is missing: ' + entry
with zipfile.ZipFile(path) as archive:
    bundle = archive.read('assets/index.android.bundle')
    for marker in [b'sms-review-auto-data', b'ahmed-settings-redesign', b'ta3meed-wallet-safe-header', b'ta3meed-investors-safe-header']:
        assert marker in bundle, 'Latest embedded feature is missing: ' + marker.decode()
    if args.require_investment_funding:
        for marker in [b'mark-sms-investment-uploaded', b'sms-investment-review-actions', b'investment/uploaded', b'investment_funded']:
            assert marker in bundle, 'Investment funding feature is missing: ' + marker.decode()
    assert not re.search(rb'#S-\d{2,4}\b', bundle), 'An old screen identifier remains embedded'
print('LATEST_APK_BINARY_INSPECTION_PASSED ' + json.dumps({'sha256': digest, 'bytes': path.stat().st_size, 'package': apk.get_package(), 'versionCode': args.version_code, 'runtime': '1.0.23', 'embedded_latest_features': True, 'investment_funding_verified': args.require_investment_funding}))
