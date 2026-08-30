#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-api/app/Http/Controllers/Api/SecureVaultController.php')
text = path.read_text(encoding='utf-8')
original = text

old_validation = """        if (empty($data['statement_day'])) {
            throw ValidationException::withMessages(['statement_day' => ['حدد تاريخ كشف البطاقة.']]);
        }
        if (($data['card_type'] ?? null) === 'credit') {
"""
new_validation = """        if (($data['card_type'] ?? null) === 'credit') {
            if (empty($data['statement_day'])) {
                throw ValidationException::withMessages(['statement_day' => ['حدد تاريخ كشف البطاقة.']]);
            }
"""

if old_validation in text:
    text = text.replace(old_validation, new_validation, 1)

old_store = "            'statement_day' => $data['statement_day'] ?? null,"
new_store = "            'statement_day' => $cardType === 'credit' ? ($data['statement_day'] ?? null) : null,"
if old_store in text:
    text = text.replace(old_store, new_store)

if text != original:
    path.write_text(text, encoding='utf-8')
    print('Patched SecureVaultController: Mada no longer requires or stores statement_day')
else:
    print('SecureVaultController already uses the current Mada rules; no patch needed')
