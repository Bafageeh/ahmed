from pathlib import Path

MOBILE = Path('ahmed-mobile/SecureVaultScreen.js')
API = Path('ahmed-api/app/Http/Controllers/Api/SecureVaultController.php')


def replace_once(text, old, new, label):
    if old in text:
        print(f'patching: {label}')
        return text.replace(old, new, 1)
    if new in text:
        print(f'already patched: {label}')
        return text
    raise SystemExit(f'pattern not found: {label}')


s = MOBILE.read_text()

s = replace_once(
    s,
    "  const startAddBankLogin = () => selectedGroup && openForm('login', { category: 'websites', record_type: 'login', owner_group: groupRef(selectedGroup) });",
    """  const startBankCredentials = async () => {
    if (!selectedGroup?.bank) return;
    let full = selectedGroup.bank;
    try {
      const response = await fetch(`${API_URL}/secure-vault/${selectedGroup.bank.id}`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
      const json = await response.json();
      if (response.ok) full = json.data;
    } catch (error) {}
    openForm('bankLogin', {
      category: 'banks', record_type: 'subscription', owner_group: '',
      title: full.title || selectedGroup.displayName || 'بنك',
      username: full.username || '', password: full.password || '',
    }, selectedGroup.bank.id);
  };""",
    'replace bank extra-login creator',
)

s = replace_once(
    s,
    "  const menuItems = getMenuItems(view, selectedGroup, startAddBank, startAddSite, startAddCard, startAddBankLogin, () => selectedGroup?.bank && startEdit(selectedGroup.bank));",
    "  const menuItems = getMenuItems(view, selectedGroup, startAddBank, startAddSite, startAddCard, startBankCredentials, () => selectedGroup?.bank && startEdit(selectedGroup.bank));",
    'menu uses bank credentials editor',
)

s = replace_once(s, 'onAddLogin={startAddBankLogin}', 'onEditCredentials={startBankCredentials}', 'details prop')

s = replace_once(
    s,
    "function BankDetails({ group, creditDebts, revealedId, onReveal, onEdit, onDelete, onAddCard, onAddLogin }) {\n  const bank = group.bank;",
    "function BankDetails({ group, creditDebts, revealedId, onReveal, onEdit, onDelete, onAddCard, onEditCredentials }) {\n  const bank = group.bank;\n  const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password));",
    'bank details signature',
)

s = replace_once(
    s,
    "    <SectionHeader title=\"بيانات الدخول\" action={bank ? 'تعديل' : ''} onAction={bank ? () => onEdit(bank) : undefined} />",
    "    <SectionHeader title=\"بيانات الدخول\" action={bank ? (hasCredentials ? 'تعديل' : 'إضافة') : ''} onAction={bank ? onEditCredentials : undefined} />",
    'credentials section',
)

legacy_block = "    {group.logins.length ? <><SectionHeader title=\"دخول إضافي\" action=\"إضافة\" onAction={onAddLogin} />{group.logins.map((login) => <SiteLoginCard key={login.id} item={login} revealed={revealedId === login.id} onReveal={() => onReveal(login)} onEdit={() => onEdit(login)} onDelete={() => onDelete(login)} compact />)}</> : null}\n"
if legacy_block in s:
    s = s.replace(legacy_block, '', 1)
    print('patching: remove extra bank-login section')
elif 'title="دخول إضافي"' not in s:
    print('already patched: remove extra bank-login section')
else:
    raise SystemExit('pattern not found: extra bank-login section')

s = replace_once(
    s,
    "  const isBank = formMode === 'bank'; const isCard = formMode === 'card'; const isLogin = formMode === 'login';",
    "  const isBank = formMode === 'bank'; const isBankLogin = formMode === 'bankLogin'; const isCard = formMode === 'card'; const isLogin = formMode === 'login';",
    'bankLogin form mode',
)

s = replace_once(
    s,
    "  const title = editingId ? 'تعديل السجل' : isBank ? 'إضافة بنك' : isCard ? 'إضافة بطاقة' : siteMode ? 'إضافة موقع أو تطبيق' : 'إضافة دخول للبنك';",
    "  const title = isBankLogin ? 'بيانات دخول البنك' : editingId ? 'تعديل السجل' : isBank ? 'إضافة بنك' : isCard ? 'إضافة بطاقة' : 'إضافة موقع أو تطبيق';",
    'form title',
)

old_bank_form = "    {isBank ? <><FormInput label=\"اسم البنك\" value={form.title} onChangeText={(value) => setField('title', value)} placeholder=\"مثال: بنك الجزيرة\" /><FormInput label=\"اسم المستخدم\" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize=\"none\" /><FormInput label=\"كلمة المرور\" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize=\"none\" /><Text style={styles.securityHint}>اسم المستخدم وكلمة المرور يُحفظان مشفرين في الخادم.</Text><FormInput label=\"ملاحظة\" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : null}"
new_bank_form = """    {isBank ? <><FormInput label=\"اسم البنك\" value={form.title} onChangeText={(value) => setField('title', value)} placeholder=\"مثال: بنك الجزيرة\" /><Text style={styles.securityHint}>بيانات الدخول تُدار من داخل صفحة البنك، ويسمح بسجل دخول واحد فقط لكل بنك.</Text></> : null}
    {isBankLogin ? <>{ownerGroup ? <View style={styles.fixedBankBox}><BankLogo bankName={ownerGroup.displayName} size={34} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}<FormInput label=\"اسم المستخدم\" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize=\"none\" /><FormInput label=\"كلمة المرور\" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize=\"none\" /><Text style={styles.securityHint}>اسم المستخدم وكلمة المرور فقط، وتُحفظ البيانات مشفرة. لا يمكن إضافة دخول ثانٍ لنفس البنك.</Text></> : null}"""
s = replace_once(s, old_bank_form, new_bank_form, 'bank forms')

old_login_form = "    {isLogin ? <>{!siteMode && ownerGroup ? <View style={styles.fixedBankBox}><BankLogo bankName={ownerGroup.displayName} size={34} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}<FormInput label={siteMode ? 'اسم الموقع أو التطبيق' : 'اسم الدخول'} value={form.title} onChangeText={(value) => setField('title', value)} placeholder={siteMode ? 'مثال: Gmail' : 'مثال: دخول الأعمال'} /><FormInput label=\"اسم المستخدم\" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize=\"none\" /><FormInput label=\"كلمة المرور\" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize=\"none\" /><FormInput label=\"الرابط (اختياري)\" value={form.url} onChangeText={(value) => setField('url', value)} autoCapitalize=\"none\" /><FormInput label=\"ملاحظة\" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline /></> : null}"
new_login_form = "    {isLogin ? <><FormInput label=\"اسم الموقع أو التطبيق\" value={form.title} onChangeText={(value) => setField('title', value)} placeholder=\"مثال: Gmail\" /><FormInput label=\"اسم المستخدم\" value={form.username} onChangeText={(value) => setField('username', value)} autoCapitalize=\"none\" /><FormInput label=\"كلمة المرور\" value={form.password} onChangeText={(value) => setField('password', value)} secureTextEntry autoCapitalize=\"none\" /></> : null}"
s = replace_once(s, old_login_form, new_login_form, 'site/app fields')

s = replace_once(
    s,
    "category: mode === 'bank' ? 'banks' : mode === 'card' ? 'cards' : 'websites', record_type: mode === 'bank' ? 'subscription' : mode === 'card' ? 'card' : 'login'",
    "category: (mode === 'bank' || mode === 'bankLogin') ? 'banks' : mode === 'card' ? 'cards' : 'websites', record_type: (mode === 'bank' || mode === 'bankLogin') ? 'subscription' : mode === 'card' ? 'card' : 'login'",
    'payload mode',
)

bank_payload = "  if (mode === 'bank') { payload.owner_group = null; payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; }"
bank_login_payload = bank_payload + "\n  if (mode === 'bankLogin') { if (!String(payload.username || '').trim()) return { error: 'اكتب اسم المستخدم.' }; if (!String(payload.password || '').trim()) return { error: 'اكتب كلمة المرور.' }; payload.owner_group = null; payload.card_type = null; payload.card_brand = null; payload.statement_day = null; payload.credit_card_debt_id = null; payload.sadad_number = ''; payload.url = ''; payload.notes = ''; }"
s = replace_once(s, bank_payload, bank_login_payload, 'bank-login validation')

old_menu = "function getMenuItems(view, selectedGroup, addBank, addSite, addCard, addBankLogin, editBank) { if (view === 'home') return [{ label: 'إضافة بنك', onPress: addBank }, { label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'banks') return [{ label: 'إضافة بنك', onPress: addBank }]; if (view === 'sites') return [{ label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'bank' && selectedGroup) return [{ label: 'إضافة بطاقة', onPress: addCard }, { label: 'إضافة دخول للبنك', onPress: addBankLogin }, ...(selectedGroup.bank ? [{ label: 'تعديل البنك', onPress: editBank }] : [])]; return []; }"
new_menu = "function getMenuItems(view, selectedGroup, addBank, addSite, addCard, editCredentials, editBank) { if (view === 'home') return [{ label: 'إضافة بنك', onPress: addBank }, { label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'banks') return [{ label: 'إضافة بنك', onPress: addBank }]; if (view === 'sites') return [{ label: 'إضافة موقع أو تطبيق', onPress: addSite }]; if (view === 'bank' && selectedGroup) { const bank = selectedGroup.bank; const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password)); return [{ label: 'إضافة بطاقة', onPress: addCard }, ...(bank ? [{ label: hasCredentials ? 'تعديل بيانات الدخول' : 'إضافة بيانات الدخول', onPress: editCredentials }, { label: 'تعديل البنك', onPress: editBank }] : [])]; } return []; }"
s = replace_once(s, old_menu, new_menu, 'bank menu')

MOBILE.write_text(s)

# API-side protection: bank-specific login records are rejected. Bank credentials live on the bank record itself.
a = API.read_text()
if '$this->validateBankLoginRule($data);' not in a:
    target = "        $data = $this->validated($request);\n        $this->validateCardLink($request, $data);"
    if a.count(target) != 2:
        raise SystemExit(f'expected two validation blocks, got {a.count(target)}')
    a = a.replace(target, "        $data = $this->validated($request);\n        $this->validateBankLoginRule($data);\n        $this->validateCardLink($request, $data);")

    anchor = "    private function validateCardLink(Request $request, array $data): void\n    {"
    method = """    private function validateBankLoginRule(array $data): void
    {
        if (($data['record_type'] ?? null) !== 'login' || ($data['category'] ?? null) !== 'websites') {
            return;
        }

        $ownerGroup = trim((string) ($data['owner_group'] ?? ''));
        if ($ownerGroup !== '' && $ownerGroup !== 'sites') {
            throw ValidationException::withMessages([
                'owner_group' => ['لكل بنك بيانات دخول واحدة فقط. عدّل بيانات دخول البنك الأساسية بدل إضافة دخول آخر.'],
            ]);
        }
    }

"""
    if anchor not in a:
        raise SystemExit('API anchor not found')
    a = a.replace(anchor, method + anchor, 1)
    API.write_text(a)
    print('patching: API single-login rule')
else:
    print('already patched: API single-login rule')

print('Secure vault single-login patch completed.')
