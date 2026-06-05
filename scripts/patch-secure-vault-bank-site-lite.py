from pathlib import Path
import base64

p = Path('ahmed-mobile/SecureVaultScreen.js')
s = p.read_text(encoding='utf-8')

def b(x):
    return base64.b64decode(x).decode('utf-8')

pairs = [
('ICBjb25zdCBzdGFydEFkZEJhbmsgPSAoKSA9PiBvcGVuRm9ybSgnYmFuaycsIHsgY2F0ZWdvcnk6ICdiYW5rcycsIHJlY29yZF90eXBlOiAnc3Vic2NyaXB0aW9uJyB9KTsKICBjb25zdCBzdGFydEFkZExvZ2luID0gKCkgPT4gb3BlbkZvcm0oJ2xvZ2luJywgeyBjYXRlZ29yeTogJ3dlYnNpdGVzJywgcmVjb3JkX3R5cGU6ICdsb2dpbicsIG93bmVyX2dyb3VwOiBmaXJzdEJhbmtSZWYodmF1bHQuZ3JvdXBzKSB9KTs=', 'ICBjb25zdCBzdGFydEFkZEJhbmsgPSAoKSA9PiBvcGVuRm9ybSgnYmFuaycsIHsgY2F0ZWdvcnk6ICdiYW5rcycsIHJlY29yZF90eXBlOiAnc3Vic2NyaXB0aW9uJyB9KTsKICBjb25zdCBzdGFydEFkZFNpdGUgPSAoKSA9PiBvcGVuRm9ybSgnc2l0ZScsIHsgY2F0ZWdvcnk6ICd3ZWJzaXRlcycsIHJlY29yZF90eXBlOiAnbG9naW4nLCBvd25lcl9ncm91cDogJ3NpdGUnIH0pOwogIGNvbnN0IHN0YXJ0QWRkQWNjb3VudCA9IChncm91cCkgPT4gb3BlbkZvcm0oJ2FjY291bnQnLCB7IGNhdGVnb3J5OiAnYWNjb3VudHMnLCByZWNvcmRfdHlwZTogJ3N1YnNjcmlwdGlvbicsIG93bmVyX2dyb3VwOiBncm91cFJlZihncm91cCkgfSk7CiAgY29uc3Qgc3RhcnRBZGRCYW5rTG9naW4gPSAoZ3JvdXApID0+IG9wZW5Gb3JtKCdsb2dpbicsIHsgY2F0ZWdvcnk6ICd3ZWJzaXRlcycsIHJlY29yZF90eXBlOiAnbG9naW4nLCBvd25lcl9ncm91cDogZ3JvdXBSZWYoZ3JvdXApLCB0aXRsZTogZ3JvdXAuZGlzcGxheU5hbWUgPyBg2K/YrtmI2YQgJHtncm91cC5kaXNwbGF5TmFtZX1gIDogJ9iv2K7ZiNmEINin2YTYqNmG2YMnIH0pOwogIGNvbnN0IHN0YXJ0QWRkQ2FyZCA9IChncm91cCkgPT4gb3BlbkZvcm0oJ2NhcmQnLCB7IGNhdGVnb3J5OiAnY2FyZHMnLCByZWNvcmRfdHlwZTogJ2NhcmQnLCBvd25lcl9ncm91cDogZ3JvdXBSZWYoZ3JvdXApLCBjYXJkX2JyYW5kOiBncm91cC5kaXNwbGF5TmFtZSB8fCAnJyB9KTs='),
]
for old, new in pairs:
    s = s.replace(b(old), b(new))

s = s.replace("<Text style={styles.dropdownText}>دخول</Text>", "<Text style={styles.dropdownText}>الموقع</Text>")
s = s.replace("onPress={startAddLogin}", "onPress={startAddSite}")
s = s.replace("<Text style={styles.sectionTitle}>دخول</Text>", "<Text style={styles.sectionTitle}>الموقع</Text>")
s = s.replace("لا توجد بطائق دخول.", "لا توجد بيانات موقع.")
s = s.replace("<BankRow key={group.key} group={group} onEdit={startEdit} onDelete={deleteItem} />", "<BankRow key={group.key} group={group} onEdit={startEdit} onDelete={deleteItem} onAddAccount={() => startAddAccount(group)} onAddBankLogin={() => startAddBankLogin(group)} onAddCard={() => startAddCard(group)} />")

old = "function BankRow({ group, onEdit, onDelete }) {\n  return <View style={styles.bankCard}><View style={styles.rowBetween}><View style={styles.rowActions}>{group.bank ? <><TouchableOpacity style={styles.smallEditButton} onPress={() => onEdit(group.bank)}><Text style={styles.smallEditText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.smallDeleteButton} onPress={() => onDelete(group.bank)}><Text style={styles.smallDeleteText}>حذف</Text></TouchableOpacity></> : null}</View><View style={styles.bankTitleBlock}><Text style={styles.bankName}>{bankLabel(group.displayName)}</Text>{group.bank?.notes ? <Text style={styles.platformText}>{group.bank.notes}</Text> : null}</View></View></View>;\n}"
new = "function BankRow({ group, onEdit, onDelete, onAddAccount, onAddBankLogin, onAddCard }) {\n  return <View style={styles.bankCard}><View style={styles.rowBetween}><View style={styles.rowActions}>{group.bank ? <><TouchableOpacity style={styles.smallEditButton} onPress={() => onEdit(group.bank)}><Text style={styles.smallEditText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.smallDeleteButton} onPress={() => onDelete(group.bank)}><Text style={styles.smallDeleteText}>حذف</Text></TouchableOpacity></> : null}</View><View style={styles.bankTitleBlock}><Text style={styles.bankName}>{bankLabel(group.displayName)}</Text><Text style={styles.platformText}>إضافات البنك: حسابات، دخول البنك، بطائق</Text>{group.bank?.notes ? <Text style={styles.platformText}>{group.bank.notes}</Text> : null}</View></View><View style={styles.bankActionsRow}><TouchableOpacity style={styles.bankActionButton} onPress={onAddAccount}><Text style={styles.bankActionText}>+ حساب</Text></TouchableOpacity><TouchableOpacity style={styles.bankActionButton} onPress={onAddBankLogin}><Text style={styles.bankActionText}>+ دخول البنك</Text></TouchableOpacity><TouchableOpacity style={styles.bankActionButton} onPress={onAddCard}><Text style={styles.bankActionText}>+ بطاقة</Text></TouchableOpacity></View></View>;\n}"
s = s.replace(old, new)

if 'bankActionsRow' not in s:
    s = s.replace("bankName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },", "bankName: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' }, bankActionsRow: { marginTop: 12, flexDirection: 'row-reverse', gap: 8 }, bankActionButton: { flex: 1, backgroundColor: '#ecfeff', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#cffafe' }, bankActionText: { color: '#0e7490', fontWeight: '900', fontSize: 14 },")

s = s.replace("if (mode === 'login') { if (!groups.length) return { error: 'أضف بنكًا أولاً.' }; if (!payload.owner_group) return { error: 'اختر البنك أولاً.' }; if (!payload.title.trim()) payload.title = payload.username || 'دخول البنك'; }", "if (mode === 'login') { if (!payload.owner_group) payload.owner_group = 'site'; if (!payload.title.trim()) payload.title = payload.username || 'الموقع'; }")

p.write_text(s, encoding='utf-8')
print('lite secure vault patch applied')
