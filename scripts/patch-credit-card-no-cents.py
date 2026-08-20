#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/CreditCardDebtsScreen.js')
text = path.read_text(encoding='utf-8')

old = """const money = (value) => `${numberValue(value).toLocaleString('en-US', {\n  minimumFractionDigits: 2,\n  maximumFractionDigits: 2,\n})} ر.س`;"""
new = """const money = (value) => `${numberValue(value).toLocaleString('en-US', {\n  minimumFractionDigits: 0,\n  maximumFractionDigits: 0,\n})} ر.س`;"""

if old not in text:
    if "minimumFractionDigits: 0" in text and "maximumFractionDigits: 0" in text:
        print('Credit-card amounts already display without halalas.')
        raise SystemExit(0)
    raise SystemExit('Expected credit-card money formatter was not found.')

text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Removed halala decimals from all credit-card amount displays.')
