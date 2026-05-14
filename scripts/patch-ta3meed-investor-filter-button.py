#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')

old_filter = '<CompactFilter label="المستثمر" value={investorLabel} onPress={() => onOpenMore ? onOpenMore() : onBack?.()} />'
new_filter = '<CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker(\'investor\')} />'
text = text.replace(old_filter, new_filter)

# Keep the bottom-left floating button as the shortcut to More, not investor filter.
old_floating = "onPress={() => setPicker('investor')}\n        style={styles.investorFloatingButton}"
new_floating = "onPress={() => onOpenMore ? onOpenMore() : onBack?.()}\n        style={styles.investorFloatingButton}"
text = text.replace(old_floating, new_floating)

if new_filter not in text:
    raise SystemExit('Investor compact filter was not patched correctly')

if old_floating in text:
    raise SystemExit('Floating More button is still wired to investor picker')

if "onPress={() => onOpenMore ? onOpenMore() : onBack?.()}\n        style={styles.investorFloatingButton}" not in text:
    raise SystemExit('Floating More button was not restored correctly')

path.write_text(text, encoding='utf-8')
print('Patched Ta3meed: top investor filter opens investor picker; floating button opens More')
