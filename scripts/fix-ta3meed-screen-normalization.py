#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')

lines = []
for line in text.splitlines(True):
    if 'resetButtonText' in line and 'hasFilters ?' in line:
        continue
    lines.append(line)
text = ''.join(lines)

old_sort = '    }).sort((a, b) => withdrawalSortValue(b) - withdrawalSortValue(a));'
new_sort = '''    }).sort((a, b) => {
      const dateValue = (item) => {
        const dateText = String(item?.maturity_date || item?.due_date || '').slice(0, 10);
        if (!dateText) return null;
        const value = new Date(`${dateText}T00:00:00`).getTime();
        return Number.isFinite(value) ? value : null;
      };
      const aValue = dateValue(a);
      const bValue = dateValue(b);
      if (aValue === null && bValue !== null) return -1;
      if (aValue !== null && bValue === null) return 1;
      if (aValue !== null && bValue !== null && aValue !== bValue) return aValue - bValue;
      return String(a?.reference_number || a?.code || a?.id || '').localeCompare(String(b?.reference_number || b?.code || b?.id || ''), 'ar');
    });'''

if old_sort in text:
    text = text.replace(old_sort, new_sort)
elif 'aValue === null && bValue !== null' not in text:
    raise RuntimeError('sort marker not found')

if 'resetButtonText' in text and 'hasFilters ?' in text:
    raise RuntimeError('reset button still exists')
if 'aValue === null && bValue !== null' not in text:
    raise RuntimeError('sort not applied')

path.write_text(text, encoding='utf-8')
print('ta3meed screen normalized')
