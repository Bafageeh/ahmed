from pathlib import Path
import re

p = Path('ahmed-mobile/SecureVaultScreen.js')
s = p.read_text(encoding='utf-8')


def rep(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f'pattern not found: {label}')
    s = s.replace(old, new, 1)


rep(
    "  title: '', username: '', password: '', url: '', email: '', phone: '', purpose: '', tags: '',\n",
    "  title: '', username: '', password: '', url: '', email: '', phone: '', purpose: '', tags: '', iban: '', account_number: '',\n",
    'empty account fields',
)
rep(
    "  const startAddCard = () => selectedGroup && openForm('card', { category: 'cards', record_type: 'card', owner_group: groupRef(selectedGroup), card_type: 'credit', card_brand: 'visa' });\n",
    "  const startAddCard = () => selectedGroup && openForm('card', { category: 'cards', record_type: 'card', owner_group: groupRef(selectedGroup), card_type: 'credit', card_brand: 'visa' });\n  const startAddAccount = () => selectedGroup && openForm('account', { category: 'accounts', record_type: 'subscription', owner_group: groupRef(selectedGroup), title: 'حساب بنكي', iban: '', account_number: '' });\n",
    'start add account',
)
rep(
    "      owner_group: full.owner_group || '', category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'card' ? 'cards' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin') ? 'subscription' : mode === 'card' ? 'card' : 'login',\n      title: full.title || '', username: full.username || '', password: full.password || '', url: full.url || '', notes: full.notes || '',\n",
    "      owner_group: full.owner_group || '', category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'card' ? 'cards' : mode === 'account' ? 'accounts' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin' || mode === 'account') ? 'subscription' : mode === 'card' ? 'card' : 'login',\n      title: full.title || '', username: full.username || '', password: full.password || '', url: full.url || '', notes: full.notes || '', iban: full.iban || full.username || '', account_number: full.account_number || full.purpose || '',\n",
    'edit account mapping',
)
rep(
    "  const menuItems = getMenuItems(view, selectedGroup, startAddBank, startAddSite, startAddCard, startBankCredentials, () => selectedGroup?.bank && startEdit(selectedGroup.bank));\n",
    "  const menuItems = getMenuItems(view, selectedGroup, startAddBank, startAddSite, startAddCard, startAddAccount, startBankCredentials, () => selectedGroup?.bank && startEdit(selectedGroup.bank));\n",
    'menu call',
)
rep(
    "          {view === 'bank' && selectedGroup ? <BankDetails group={selectedGroup} creditDebts={creditDebts} revealedId={revealedId} onReveal={revealItem} onEdit={startEdit} onDelete={deleteItem} onAddCard={startAddCard} onEditCredentials={startBankCredentials} /> : null}\n",
    "          {view === 'bank' && selectedGroup ? <BankDetails group={selectedGroup} creditDebts={creditDebts} revealedId={revealedId} onReveal={revealItem} onEdit={startEdit} onDelete={deleteItem} onAddCard={startAddCard} onAddAccount={startAddAccount} onEditCredentials={startBankCredentials} /> : null}\n",
    'bank details props',
)
rep(
    "function BankDetails({ group, creditDebts, revealedId, onReveal, onEdit, onDelete, onAddCard, onEditCredentials }) {\n",
    "function BankDetails({ group, creditDebts, revealedId, onReveal, onEdit, onDelete, onAddCard, onAddAccount, onEditCredentials }) {\n",
    'bank details signature',
)
rep(
    "    {group.accounts.length ? <BankAccountsDropdown accounts={group.accounts} open={accountsOpen} onToggle={() => setAccountsOpen((value) => !value)} revealedId={revealedId} onReveal={onReveal} /> : null}\n",
    "    <BankAccountsDropdown accounts={group.accounts} open={accountsOpen} onToggle={() => setAccountsOpen((value) => !value)} onAddAccount={onAddAccount} onEdit={onEdit} onDelete={onDelete} />\n",
    'always show accounts section',
)

account_block = '''function BankAccountsDropdown({ accounts, open, onToggle, onAddAccount, onEdit, onDelete }) {
  const countLabel = accounts.length === 1 ? 'حساب واحد' : `${accounts.length} حسابات`;
  return <><SectionHeader title="الحسابات البنكية" action="إضافة حساب" onAction={onAddAccount} />{accounts.length ? <View style={styles.accountsDropdown}><TouchableOpacity style={styles.accountsDropdownHeader} activeOpacity={0.84} onPress={onToggle}><View style={styles.accountsDropdownIcon}><Text style={styles.accountsDropdownIconText}>🏦</Text></View><View style={styles.accountsDropdownText}><Text style={styles.accountsDropdownTitle}>الحسابات البنكية</Text><Text style={styles.accountsDropdownSubtitle}>{open ? 'اضغط لإخفاء الحسابات' : 'اضغط لعرض الحسابات'}</Text></View><View style={styles.accountsDropdownMeta}><View style={styles.accountsCountBadge}><Text style={styles.accountsCountText}>{countLabel}</Text></View><Text style={styles.accountsChevron}>{open ? '⌃' : '⌄'}</Text></View></TouchableOpacity>{open ? <View style={styles.accountsDropdownBody}>{accounts.map((account) => <BankAccountCard key={account.id} item={account} onEdit={() => onEdit(account)} onDelete={() => onDelete(account)} nested />)}</View> : null}</View> : <EmptyCard text="لا توجد حسابات بنكية محفوظة لهذا البنك." />}</>;
}
function BankAccountCard({ item, onEdit, onDelete, nested = false }) {
  const iban = String(item.iban || item.username || '').trim();
  const accountNumber = String(item.account_number || item.purpose || '').trim();
  return <View style={[styles.bankAccountCompactCard, nested && styles.bankAccountCompactNested]}>
    <View style={styles.siteActions}><TouchableOpacity style={styles.iconAction} onPress={onEdit}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.iconAction} onPress={onDelete}><Text>🗑️</Text></TouchableOpacity></View>
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountCompactValue} selectable>{iban || '—'}</Text><Text style={styles.bankAccountCompactLabel}>الآيبان</Text></View>
    <View style={styles.bankAccountCompactDivider} />
    <View style={styles.bankAccountCompactRow}><Text style={styles.bankAccountNumberValue} selectable>{accountNumber || '—'}</Text><Text style={styles.bankAccountCompactLabel}>رقم الحساب</Text></View>
  </View>;
}
'''
s, count = re.subn(r"function BankAccountsDropdown\([\s\S]*?(?=function SitesView\()", account_block, s, count=1)
if count != 1:
    raise SystemExit('pattern not found: account component block')

rep(
    "  const isBank = formMode === 'bank'; const isBankLogin = formMode === 'bankLogin'; const isCard = formMode === 'card'; const isLogin = formMode === 'login';\n",
    "  const isBank = formMode === 'bank'; const isBankLogin = formMode === 'bankLogin'; const isAccount = formMode === 'account'; const isCard = formMode === 'card'; const isLogin = formMode === 'login';\n",
    'account modal flag',
)
rep(
    "  const title = isBankLogin ? 'بيانات دخول البنك' : editingId ? 'تعديل السجل' : isBank ? 'إضافة بنك' : isCard ? 'إضافة بطاقة' : 'إضافة موقع أو تطبيق';\n",
    "  const title = isBankLogin ? 'بيانات دخول البنك' : editingId ? (isAccount ? 'تعديل حساب بنكي' : 'تعديل السجل') : isBank ? 'إضافة بنك' : isAccount ? 'إضافة حساب بنكي' : isCard ? 'إضافة بطاقة' : 'إضافة موقع أو تطبيق';\n",
    'account modal title',
)
rep(
    "    {isLogin ? <><FormInput label=\"اسم الموقع أو التطبيق\" value={form.title} onChangeText={(value) => setField('title', value)} placeholder=\"مثال: Gmail\" /><FormInput label=\"اسم المستخدم\" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize=\"none\" /><FormInput label=\"كلمة المرور\" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize=\"none\" /></> : null}\n    {isCard ? <View style={styles.cardFormCompact}>\n",
    "    {isLogin ? <><FormInput label=\"اسم الموقع أو التطبيق\" value={form.title} onChangeText={(value) => setField('title', value)} placeholder=\"مثال: Gmail\" /><FormInput label=\"اسم المستخدم\" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize=\"none\" /><FormInput label=\"كلمة المرور\" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize=\"none\" /></> : null}\n    {isAccount ? <>{ownerGroup ? <View style={styles.fixedBankBox}><BankLogo bankName={ownerGroup.displayName} size={34} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}<FormInput label=\"اسم الحساب\" value={form.title} onChangeText={(value) => setField('title', value)} placeholder=\"مثال: الحساب الجاري\" /><FormInput label=\"رقم الآيبان\" value={form.iban} onChangeText={(value) => setField('iban', String(value || '').replace(/\\s+/g, '').toUpperCase())} autoCapitalize=\"characters\" placeholder=\"SA...\" /><FormInput label=\"رقم الحساب\" value={form.account_number} onChangeText={(value) => setField('account_number', digitsOnly(value, 34))} keyboardType=\"number-pad\" /><Text style={styles.securityHint}>يمكن حفظ رقم الآيبان ورقم الحساب، وسيظهران مباشرة داخل صفحة البنك.</Text></> : null}\n    {isCard ? <View style={styles.cardFormCompact}>\n",
    'account modal fields',
)
rep(
    "  const payload = { ...emptyForm, ...form, is_favorite: false, category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'card' ? 'cards' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin') ? 'subscription' : mode === 'card' ? 'card' : 'login', expiry_month: form.expiry_month ? Number(form.expiry_month) : null, expiry_year: form.expiry_year ? Number(form.expiry_year) : null, statement_day: form.statement_day ? Number(form.statement_day) : null, credit_card_debt_id: form.credit_card_debt_id ? Number(form.credit_card_debt_id) : null };\n",
    "  const payload = { ...emptyForm, ...form, is_favorite: false, category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'account' ? 'accounts' : mode === 'card' ? 'cards' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin' || mode === 'account') ? 'subscription' : mode === 'card' ? 'card' : 'login', expiry_month: form.expiry_month ? Number(form.expiry_month) : null, expiry_year: form.expiry_year ? Number(form.expiry_year) : null, statement_day: form.statement_day ? Number(form.statement_day) : null, credit_card_debt_id: form.credit_card_debt_id ? Number(form.credit_card_debt_id) : null };\n",
    'account payload category',
)
rep(
    "  if (!String(payload.title || '').trim()) return { error: mode === 'bank' ? 'اكتب اسم البنك.' : mode === 'card' ? 'اكتب اسم البطاقة.' : 'اكتب اسم الموقع أو الدخول.' };\n",
    "  if (!String(payload.title || '').trim()) return { error: mode === 'bank' ? 'اكتب اسم البنك.' : mode === 'account' ? 'اكتب اسم الحساب.' : mode === 'card' ? 'اكتب اسم البطاقة.' : 'اكتب اسم الموقع أو الدخول.' };\n",
    'account title validation',
)
rep(
    "  if (mode === 'login') { payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }\n  if (mode === 'card') {\n",
    "  if (mode === 'login') { payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }\n  if (mode === 'account') { const iban = String(form.iban || form.username || '').replace(/\\s+/g, '').toUpperCase(); const accountNumber = String(form.account_number || form.purpose || '').replace(/\\s+/g, ''); if (!payload.owner_group) return { error: 'تعذر تحديد البنك.' }; if (!iban && !accountNumber) return { error: 'أدخل رقم الآيبان أو رقم الحساب.' }; payload.username = iban; payload.purpose = accountNumber; payload.password = ''; payload.url = ''; payload.email = ''; payload.phone = ''; payload.tags = ''; payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }\n  if (mode === 'card') {\n",
    'account payload mapping',
)
rep(
    "function getMenuItems(view, selectedGroup, addBank, addSite, addCard, editCredentials, editBank) { if (view === 'home') return [{ label: 'إضافة بنك', onPress: addBank }, { label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'banks') return [{ label: 'إضافة بنك', onPress: addBank }]; if (view === 'sites') return [{ label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'bank' && selectedGroup) { const bank = selectedGroup.bank; const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password)); return [{ label: 'إضافة بطاقة', onPress: addCard }, ...(bank ? [{ label: hasCredentials ? 'تعديل بيانات الدخول' : 'إضافة بيانات الدخول', onPress: editCredentials }, { label: 'تعديل البنك', onPress: editBank }] : [])]; } return []; }\n",
    "function getMenuItems(view, selectedGroup, addBank, addSite, addCard, addAccount, editCredentials, editBank) { if (view === 'home') return [{ label: 'إضافة بنك', onPress: addBank }, { label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'banks') return [{ label: 'إضافة بنك', onPress: addBank }]; if (view === 'sites') return [{ label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'bank' && selectedGroup) { const bank = selectedGroup.bank; const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password)); return [{ label: 'إضافة حساب بنكي', onPress: addAccount }, { label: 'إضافة بطاقة', onPress: addCard }, ...(bank ? [{ label: hasCredentials ? 'تعديل بيانات الدخول' : 'إضافة بيانات الدخول', onPress: editCredentials }, { label: 'تعديل البنك', onPress: editBank }] : [])]; } return []; }\n",
    'account menu item',
)

p.write_text(s, encoding='utf-8')
