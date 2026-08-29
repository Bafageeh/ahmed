from pathlib import Path
import re

mobile_path = Path('ahmed-mobile/SecureVaultScreen.js')
mobile = mobile_path.read_text()

# Keep bank-account identifiers visible.
account_pattern = re.compile(r"function BankAccountCard\(\{ item, revealed, onReveal, nested = false \}\) \{.*?\n\}\nfunction SitesView", re.S)
account_component = '''function BankAccountCard({ item, revealed, onReveal, nested = false }) {
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
mobile, n = account_pattern.subn(account_component, mobile, count=1)
if n != 1:
    raise SystemExit(f'BankAccountCard replacement failed: {n}')

# Card summary: debit/mada cards do not show credit-limit or SADAD fields.
card_pattern = re.compile(r"function BankCard\(\{ item, creditDebts, revealed, onReveal, onEdit, onDelete \}\) \{.*?\n\}\nfunction NetworkBadge", re.S)
card_component = '''function BankCard({ item, creditDebts, revealed, onReveal, onEdit, onDelete }) {
  const debt = creditDebts.find((entry) => String(entry.id) === String(item.credit_card_debt_id));
  const credit = item.card_type === 'credit';
  const brand = item.card_type === 'mada' ? 'مدى' : item.card_brand === 'mastercard' ? 'ماستركارد' : 'فيزا';
  const hasRevealable = item.has_card_number || item.card_last_four || (credit && item.has_sadad_number);
  return <View style={styles.cardBox}>
    <View style={styles.cardHeader}><View style={styles.siteActions}><TouchableOpacity style={styles.iconAction} onPress={onEdit}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.iconAction} onPress={onDelete}><Text>🗑️</Text></TouchableOpacity></View><View style={styles.cardTitleBlock}><Text style={styles.cardName}>{item.title || 'بطاقة'}</Text><Text style={styles.cardBrand}>{credit ? `ائتمانية • ${brand}` : 'مدى'}</Text></View><NetworkBadge brand={credit ? item.card_brand : 'mada'} /></View>
    <View style={styles.specGrid}>
      <Spec label="نوع البطاقة" value={credit ? `ائتمانية - ${brand}` : 'مدى'} />
      <Spec label="تاريخ الكشف" value={item.statement_day ? `يوم ${item.statement_day}` : '—'} />
      {credit ? <Spec label="الحد الائتماني" value={debt ? money(debt.credit_limit) : 'غير مربوط'} /> : null}
      {credit ? <Spec label="رقم سداد" value={revealed ? (item.sadad_number || '—') : (item.has_sadad_number ? '••••••' : '—')} /> : null}
    </View>
    {hasRevealable ? <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء البيانات' : 'فك بيانات البطاقة'}</Text></TouchableOpacity> : null}
    {revealed && item.card_number ? <SecretRow label="رقم البطاقة" value={item.card_number} /> : item.card_last_four ? <Text style={styles.lastFour}>آخر 4 أرقام: {item.card_last_four}</Text> : null}
  </View>;
}
function NetworkBadge'''
mobile, n = card_pattern.subn(card_component, mobile, count=1)
if n != 1:
    raise SystemExit(f'BankCard replacement failed: {n}')

# Compact card-entry modal. Conditional fields eliminate wasted space.
form_pattern = re.compile(r"    \{isCard \? .*?\n    \{!!message", re.S)
form_block = '''    {isCard ? <View style={styles.cardFormCompact}>
      {ownerGroup ? <View style={[styles.fixedBankBox, styles.fixedBankBoxCompact]}><BankLogo bankName={ownerGroup.displayName} size={32} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}
      <FormInput label="اسم البطاقة" value={form.title} onChangeText={(value) => setField('title', value)} placeholder="مثال: أجواء إنفينيت" />
      <View style={styles.compactChoiceRow}>
        <View style={styles.compactChoiceBlock}><Text style={styles.inputLabel}>نوع البطاقة</Text><SegmentedRow options={[{ value: 'mada', label: 'مدى' }, { value: 'credit', label: 'ائتمانية' }]} value={form.card_type} onChange={(value) => { setField('card_type', value); if (value === 'mada') { setField('card_brand', 'mada'); setField('credit_card_debt_id', ''); setField('sadad_number', ''); } else if (form.card_brand === 'mada') setField('card_brand', 'visa'); }} /></View>
        {form.card_type === 'credit' ? <View style={styles.compactChoiceBlock}><Text style={styles.inputLabel}>الشبكة</Text><SegmentedRow options={[{ value: 'visa', label: 'Visa' }, { value: 'mastercard', label: 'Mastercard' }]} value={form.card_brand} onChange={(value) => setField('card_brand', value)} /></View> : null}
      </View>
      {form.card_type === 'credit' ? <View style={styles.compactPanel}><Text style={styles.compactPanelTitle}>الحد الائتماني من شاشة المديونية</Text>{debtOptions.length ? <PickerRow options={debtOptions.map((debt) => ({ value: String(debt.id), label: `${debt.card_name || 'بطاقة'} • ${money(debt.credit_limit)}` }))} value={String(form.credit_card_debt_id || '')} onChange={(value) => setField('credit_card_debt_id', value)} /> : <Text style={styles.securityHint}>لا توجد بطاقة في شاشة مديونية بطائق الائتمان لربط الحد.</Text>}{selectedDebt ? <View style={styles.readOnlyBox}><Text style={styles.readOnlyLabel}>الحد الائتماني</Text><Text style={styles.readOnlyValue}>{money(selectedDebt.credit_limit)}</Text></View> : null}</View> : null}
      <FormInput label="رقم البطاقة (اختياري)" value={form.card_number} onChangeText={(value) => setField('card_number', digitsOnly(value, 19))} keyboardType="number-pad" />
      <View style={styles.twoColumns}><View style={styles.half}><FormInput label="سنة الانتهاء" value={String(form.expiry_year || '')} onChangeText={(value) => setField('expiry_year', digitsOnly(value, 4))} keyboardType="number-pad" placeholder="YYYY" /></View><View style={styles.half}><FormInput label="شهر الانتهاء" value={String(form.expiry_month || '')} onChangeText={(value) => setField('expiry_month', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="MM" /></View></View>
      {form.card_type === 'credit' ? <View style={styles.twoColumns}><View style={styles.half}><FormInput label="رقم سداد" value={form.sadad_number} onChangeText={(value) => setField('sadad_number', value)} keyboardType="number-pad" /></View><View style={styles.half}><FormInput label="تاريخ الكشف" value={String(form.statement_day || '')} onChangeText={(value) => setField('statement_day', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="يوم الشهر" /></View></View> : <FormInput label="تاريخ الكشف (يوم الشهر)" value={String(form.statement_day || '')} onChangeText={(value) => setField('statement_day', digitsOnly(value, 2))} keyboardType="number-pad" placeholder="مثال: 25" />}
      <Text style={styles.securityHint}>{form.card_type === 'credit' ? 'رقم البطاقة ورقم سداد يحفظان مشفرين. وسيتم تنبيهك في يوم الكشف.' : 'بطاقة مدى لا تحتوي على رقم سداد. رقم البطاقة فقط يحفظ مشفرًا.'}</Text>
      <FormInput label="ملاحظة" value={form.notes} onChangeText={(value) => setField('notes', value)} multiline />
    </View> : null}
    {!!message'''
mobile, n = form_pattern.subn(form_block, mobile, count=1)
if n != 1:
    raise SystemExit(f'card modal replacement failed: {n}')

# Add segmented helper if needed.
old_picker = "function PickerRow({ options, value, onChange }) { return <View style={styles.pickerWrap}>{options.map((option) => <TouchableOpacity key={String(option.value)} style={[styles.pickerChip, String(value) === String(option.value) && styles.pickerChipActive]} onPress={() => onChange(option.value)}><Text style={[styles.pickerText, String(value) === String(option.value) && styles.pickerTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>; }"
segmented = old_picker + "\nfunction SegmentedRow({ options, value, onChange }) { return <View style={styles.segmentedWrap}>{options.map((option) => <TouchableOpacity key={String(option.value)} style={[styles.segmentedChip, String(value) === String(option.value) && styles.segmentedChipActive]} onPress={() => onChange(option.value)}><Text style={[styles.segmentedText, String(value) === String(option.value) && styles.segmentedTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>; }"
if 'function SegmentedRow' not in mobile:
    if old_picker not in mobile:
        raise SystemExit('PickerRow anchor not found')
    mobile = mobile.replace(old_picker, segmented, 1)

# Mada must never carry SADAD in the client payload.
old_mada_payload = "} else { payload.card_brand = 'mada'; payload.credit_card_debt_id = null; }"
new_mada_payload = "} else { payload.card_brand = 'mada'; payload.credit_card_debt_id = null; payload.sadad_number = ''; }"
if old_mada_payload in mobile:
    mobile = mobile.replace(old_mada_payload, new_mada_payload, 1)
elif new_mada_payload not in mobile:
    raise SystemExit('mada payload anchor not found')

# Compact UI styles.
style_anchor = "  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.28)', justifyContent: 'flex-end' },"
compact_styles = "  cardFormCompact: { gap: 2 }, fixedBankBoxCompact: { paddingVertical: 8, marginBottom: 4 }, compactChoiceRow: { flexDirection: 'row-reverse', gap: 10, alignItems: 'flex-start' }, compactChoiceBlock: { flex: 1 }, segmentedWrap: { flexDirection: 'row-reverse', backgroundColor: '#eef2f7', borderRadius: 15, padding: 3, gap: 3 }, segmentedChip: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, segmentedChipActive: { backgroundColor: '#0f172a' }, segmentedText: { color: '#334155', fontWeight: '900', fontSize: 13 }, segmentedTextActive: { color: '#fff' }, compactPanel: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 11, marginTop: 8 }, compactPanelTitle: { color: '#334155', fontWeight: '900', fontSize: 13, textAlign: 'right', marginBottom: 7 },\n"
if 'cardFormCompact:' not in mobile:
    if style_anchor not in mobile:
        raise SystemExit('modal style anchor not found')
    mobile = mobile.replace(style_anchor, compact_styles + style_anchor, 1)

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
old_username = "            'username' => $revealSecrets ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null,\n"
new_username = "            'username' => $item->category === 'accounts'\n                ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername)\n                : ($revealSecrets ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null),\n            'iban' => $item->category === 'accounts' ? ($this->decryptNullable($encryptedUsername) ?: $legacyUsername) : null,\n"
if old_username in api:
    api = api.replace(old_username, new_username, 1)
elif "'iban' => $item->category === 'accounts'" not in api:
    raise SystemExit('SecureVaultController username anchor not found')

# Enforce no SADAD for mada on both create and update.
api = api.replace("'sadad_number_encrypted' => $this->encryptNullable($data['sadad_number'] ?? null),", "'sadad_number_encrypted' => $cardType === 'credit' ? $this->encryptNullable($data['sadad_number'] ?? null) : null,")

api_path.write_text(api)

print('patched compact card form, mada SADAD rule, and bank-account display')
