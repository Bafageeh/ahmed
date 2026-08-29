from pathlib import Path

p = Path('ahmed-mobile/SecureVaultScreen.js')
s = p.read_text()

def replace_once(old, new, label):
    global s
    if old in s:
        s = s.replace(old, new, 1)
        print('patched', label)
    elif new in s:
        print('already patched', label)
    else:
        raise SystemExit(f'pattern not found: {label}')

replace_once(
    "function buildVault(items) {\n  const banks = items.filter((item) => getMode(item) === 'bank'); const cards = items.filter((item) => getMode(item) === 'card'); const logins = items.filter((item) => getMode(item) === 'login');\n  const groups = banks.map((bank) => ({ key: bankRef(bank), bank, displayName: bank.title || 'بنك', cards: [], logins: [] })); const byKey = new Map(groups.map((group) => [group.key, group]));",
    "function buildVault(items) {\n  const banks = items.filter((item) => getMode(item) === 'bank'); const cards = items.filter((item) => getMode(item) === 'card'); const logins = items.filter((item) => getMode(item) === 'login'); const accounts = items.filter((item) => getMode(item) === 'account');\n  const groups = banks.map((bank) => ({ key: bankRef(bank), bank, displayName: bank.title || 'بنك', cards: [], accounts: [], logins: [] })); const byKey = new Map(groups.map((group) => [group.key, group]));",
    'vault accounts collection',
)
replace_once(
    "  cards.forEach((item) => { const group = findGroup(item); if (group) group.cards.push(item); }); const siteLogins = [];",
    "  cards.forEach((item) => { const group = findGroup(item); if (group) group.cards.push(item); }); accounts.forEach((item) => { const group = findGroup(item); if (group) group.accounts.push(item); }); const siteLogins = [];",
    'attach accounts to banks',
)
replace_once(
    "function getMode(item) { if (item?.record_type === 'card' || item?.category === 'cards') return 'card'; if (item?.category === 'banks') return 'bank'; if (isKnownBankRecord(item)) return 'bank'; if (item?.record_type === 'login' || item?.category === 'websites') return 'login'; return 'other'; }",
    "function getMode(item) { if (item?.record_type === 'card' || item?.category === 'cards') return 'card'; if (item?.category === 'banks') return 'bank'; if (isKnownBankRecord(item)) return 'bank'; if (item?.category === 'accounts') return 'account'; if (item?.record_type === 'login' || item?.category === 'websites') return 'login'; return 'other'; }",
    'account mode',
)
replace_once(
    "    {bank ? <SecretCard item={bank} revealed={revealedId === bank.id} onReveal={() => onReveal(bank)} /> : <EmptyCard text=\"لا يوجد سجل أساسي لهذا البنك.\" />}\n    <SectionHeader title=\"البطاقات\" action=\"إضافة بطاقة\" onAction={onAddCard} />",
    "    {bank ? <SecretCard item={bank} revealed={revealedId === bank.id} onReveal={() => onReveal(bank)} /> : <EmptyCard text=\"لا يوجد سجل أساسي لهذا البنك.\" />}\n    {group.accounts.length ? <><SectionHeader title=\"الحسابات البنكية\" />{group.accounts.map((account) => <BankAccountCard key={account.id} item={account} revealed={revealedId === account.id} onReveal={() => onReveal(account)} />)}</> : null}\n    <SectionHeader title=\"البطاقات\" action=\"إضافة بطاقة\" onAction={onAddCard} />",
    'bank accounts section',
)
component = """function BankAccountCard({ item, revealed, onReveal }) {
  return <View style={styles.bankAccountCard}><View style={styles.bankAccountHeader}><View style={styles.bankAccountIcon}><Text style={styles.bankAccountIconText}>🏦</Text></View><View style={styles.bankAccountTitleBlock}><Text style={styles.bankAccountTitle}>{item.title || 'حساب بنكي'}</Text><Text style={styles.bankAccountSubtitle}>آيبان / رقم حساب محفوظ</Text></View></View><SecretRow label=\"الآيبان\" value={revealed ? (item.username || '—') : (item.has_username ? '•••• •••• •••• ••••' : '—')} />{item.purpose ? <Text style={styles.bankAccountPurpose}>{item.purpose}</Text> : null}<TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity></View>;
}
"""
if 'function BankAccountCard(' not in s:
    anchor = 'function SitesView({ items, revealedId, onReveal, onEdit, onDelete }) {'
    if anchor not in s:
        raise SystemExit('component anchor not found')
    s = s.replace(anchor, component + anchor, 1)
    print('patched bank account card')

if 'bankAccountCard:' not in s:
    anchor = "  siteCard: { backgroundColor: '#fff', borderRadius: 26, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: '#edf2f7', elevation: 2 },"
    styles = "  bankAccountCard: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#edf2f7' }, bankAccountHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 6 }, bankAccountIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }, bankAccountIconText: { fontSize: 22 }, bankAccountTitleBlock: { flex: 1 }, bankAccountTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' }, bankAccountSubtitle: { color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 3 }, bankAccountPurpose: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 8 },\n"
    if anchor not in s:
        raise SystemExit('style anchor not found')
    s = s.replace(anchor, styles + anchor, 1)
    print('patched bank account styles')

p.write_text(s)
print('done')
