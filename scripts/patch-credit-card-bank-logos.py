from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'ahmed-mobile' / 'CreditCardDebtsScreen.js'
text = path.read_text(encoding='utf-8')

import_line = "import BankLogo from './BankLogo';\n"
anchor = "import UiIcon, { ICON_COLOR, ICON_COLOR_DARK } from './UiIcon';\n"
if import_line not in text:
    if anchor not in text:
        raise SystemExit('UiIcon import anchor not found')
    text = text.replace(anchor, anchor + import_line, 1)

old = '''              <View style={styles.cardIcon}>\n                <UiIcon name=\"payments\" size={24} color={ICON_COLOR} />\n              </View>'''
new = '''              <View style={styles.cardIcon}>\n                <BankLogo bankName={item.bank_name} size={40} />\n              </View>'''

if old in text:
    text = text.replace(old, new, 1)
elif '<BankLogo bankName={item.bank_name} size={40} />' not in text:
    raise SystemExit('Credit-card icon block not found')

path.write_text(text, encoding='utf-8')
print('Credit-card bank logos patch applied')
