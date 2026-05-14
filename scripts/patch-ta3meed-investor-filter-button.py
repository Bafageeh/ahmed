#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')

replacements = {
    'onPress={() => onOpenMore ? onOpenMore() : onBack?.()}': "onPress={() => setPicker('investor')}",
    'onPress={() => onOpenMore ? onOpenMore() : onBack?.()}\n        style={styles.investorFloatingButton}': "onPress={() => setPicker('investor')}\n        style={styles.investorFloatingButton}",
}

changed = False
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
        changed = True

if "label=\"المستثمر\" value={investorLabel} onPress={() => setPicker('investor')}" not in text:
    raise SystemExit('Investor compact filter was not patched correctly')

if "style={styles.investorFloatingButton}" in text and "onPress={() => setPicker('investor')}\n        style={styles.investorFloatingButton}" not in text:
    raise SystemExit('Investor floating button was not patched correctly')

path.write_text(text, encoding='utf-8')
print('Patched Ta3meed investor filter buttons to open investor picker')
