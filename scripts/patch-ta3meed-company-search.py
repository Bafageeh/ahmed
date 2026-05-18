#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')

old = """        meta.withdrawal_date,
        ...(item.allocations || []).map((allocation) => allocation.investor_name),"""
new = """        meta.withdrawal_date,
        meta.company_name,
        item.company_name,
        ...(item.allocations || []).map((allocation) => allocation.investor_name),"""

if old in text and 'meta.company_name' not in text.split(old)[0][-500:]:
    text = text.replace(old, new, 1)
elif 'meta.company_name' not in text:
    raise RuntimeError('Ta3meed search text block not found')

if 'meta.company_name' not in text:
    raise RuntimeError('company search marker missing')

path.write_text(text, encoding='utf-8')
print('Ta3meed search now includes company name')
