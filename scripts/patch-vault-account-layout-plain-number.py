from pathlib import Path
import re

p = Path('ahmed-mobile/SecureVaultScreen.js')
s = p.read_text()

old_pattern = re.compile(r"function BankAccountCard\(\{ item, revealed, onReveal, nested = false \}\) \{.*?\n\}\nfunction SitesView", re.S)
new_component = '''function BankAccountCard({ item, revealed, onReveal, nested = false }) {
  const accountNumber = String(item.purpose || '').trim();
  return <View style={[styles.bankAccountCompactCard, nested && styles.bankAccountCompactNested]}>
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountCompactValue}>{revealed ? (item.username || '—') : (item.has_username ? '•••• •••• •••• ••••' : '—')}</Text><Text style={styles.bankAccountCompactLabel}>الآيبان</Text></View>
    <View style={styles.bankAccountCompactDivider} />
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountNumberValue} selectable>{accountNumber || '—'}</Text><Text style={styles.bankAccountCompactLabel}>رقم الحساب</Text></View>
    {item.has_username || item.username ? <TouchableOpacity style={styles.accountRevealButton} onPress={onReveal}><Text style={styles.accountRevealText}>{revealed ? 'إخفاء الآيبان' : 'فك الآيبان'}</Text></TouchableOpacity> : null}
  </View>;
}
function SitesView'''

s2, n = old_pattern.subn(new_component, s, count=1)
if n != 1:
    raise SystemExit(f'BankAccountCard replacement failed: {n}')
s = s2

style_anchor = "  siteCard: { backgroundColor: '#fff', borderRadius: 26, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: '#edf2f7', elevation: 2 },"
styles = "  bankAccountCompactCard: { backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 9, borderWidth: 1, borderColor: '#e7edf5' }, bankAccountCompactNested: { marginBottom: 9 }, bankAccountCompactRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, bankAccountCompactLabel: { color: '#64748b', fontSize: 13, fontWeight: '800', textAlign: 'right', minWidth: 78 }, bankAccountCompactValue: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '800', textAlign: 'left' }, bankAccountNumberValue: { flex: 1, color: '#334155', fontSize: 15, fontWeight: '700', textAlign: 'left' }, bankAccountCompactDivider: { height: 1, backgroundColor: '#e8eef5', marginVertical: 3 }, accountRevealButton: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#cffafe', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }, accountRevealText: { color: '#0e7490', fontWeight: '900', fontSize: 12 },\n"
if 'bankAccountCompactCard:' not in s:
    if style_anchor not in s:
        raise SystemExit('siteCard style anchor not found')
    s = s.replace(style_anchor, styles + style_anchor, 1)

p.write_text(s)
print('patched compact account layout and plaintext account-number display')
