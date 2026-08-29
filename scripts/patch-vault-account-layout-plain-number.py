from pathlib import Path
import re

mobile_path = Path('ahmed-mobile/SecureVaultScreen.js')
mobile = mobile_path.read_text()

old_pattern = re.compile(r"function BankAccountCard\(\{ item, revealed, onReveal, nested = false \}\) \{.*?\n\}\nfunction SitesView", re.S)
new_component = '''function BankAccountCard({ item, revealed, onReveal, nested = false }) {
  // Bank account identifiers are always visible in account cards.
  // Login usernames/passwords for the bank itself remain protected elsewhere.
  const iban = String(item.iban || item.username || '').trim();
  const accountNumber = String(item.account_number || item.purpose || '').trim();
  return <View style={[styles.bankAccountCompactCard, nested && styles.bankAccountCompactNested]}>
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountCompactValue} selectable>{iban || '—'}</Text><Text style={styles.bankAccountCompactLabel}>الآيبان</Text></View>
    <View style={styles.bankAccountCompactDivider} />
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountNumberValue} selectable>{accountNumber || '—'}</Text><Text style={styles.bankAccountCompactLabel}>رقم الحساب</Text></View>
  </View>;
}
function SitesView'''

mobile2, n = old_pattern.subn(new_component, mobile, count=1)
if n != 1:
    raise SystemExit(f'BankAccountCard replacement failed: {n}')
mobile = mobile2

style_anchor = "  siteCard: { backgroundColor: '#fff', borderRadius: 26, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: '#edf2f7', elevation: 2 },"
styles = "  bankAccountCompactCard: { backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 9, borderWidth: 1, borderColor: '#e7edf5' }, bankAccountCompactNested: { marginBottom: 9 }, bankAccountCompactRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }, bankAccountCompactLabel: { color: '#64748b', fontSize: 13, fontWeight: '800', textAlign: 'right', minWidth: 78 }, bankAccountCompactValue: { flex: 1, color: '#0f172a', fontSize: 15, fontWeight: '800', textAlign: 'left' }, bankAccountNumberValue: { flex: 1, color: '#334155', fontSize: 15, fontWeight: '700', textAlign: 'left' }, bankAccountCompactDivider: { height: 1, backgroundColor: '#e8eef5', marginVertical: 3 }, accountRevealButton: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#cffafe', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }, accountRevealText: { color: '#0e7490', fontWeight: '900', fontSize: 12 },\n"
if 'bankAccountCompactCard:' not in mobile:
    if style_anchor not in mobile:
        raise SystemExit('siteCard style anchor not found')
    mobile = mobile.replace(style_anchor, styles + style_anchor, 1)

mobile_path.write_text(mobile)

api_path = Path('ahmed-api/app/Http/Controllers/Api/SecureVaultController.php')
api = api_path.read_text()

# Account number lives in the normal plaintext purpose column and is returned on list calls.
if "'account_number' =>" not in api:
    anchor = "            'purpose' => $item->purpose,\n"
    if anchor not in api:
        raise SystemExit('SecureVaultController purpose anchor not found')
    api = api.replace(anchor, anchor + "            'account_number' => $item->category === 'accounts' ? $item->purpose : null,\n", 1)

# For bank-account rows only, return the IBAN on ordinary list calls so the UI never masks it.
# Other usernames (bank login/site login) keep the existing reveal protection.
old_username = "            'username' => $revealSecrets ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null,\n"
new_username = "            'username' => $item->category === 'accounts'\n                ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername)\n                : ($revealSecrets ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null),\n            'iban' => $item->category === 'accounts' ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null,\n"
if old_username in api:
    api = api.replace(old_username, new_username, 1)
elif "'iban' => $item->category === 'accounts'" not in api:
    raise SystemExit('SecureVaultController username anchor not found')

api_path.write_text(api)

print('patched always-visible bank IBAN and plaintext account number behavior')
