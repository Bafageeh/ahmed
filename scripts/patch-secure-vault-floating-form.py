from pathlib import Path

p = Path('ahmed-mobile/SecureVaultScreen.js')
s = p.read_text(encoding='utf-8')

old = "{formOpen ? <VaultForm form={form} formMode={formMode} setField={setField} editingId={editingId} saving={saving} message={message} saveItem={saveItem} cancel={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); }} groups={vault.groups} /> : null}"
new = "{formOpen ? <View style={styles.modalOverlay}><View style={styles.modalSheet}><ScrollView showsVerticalScrollIndicator={false}><VaultForm form={form} formMode={formMode} setField={setField} editingId={editingId} saving={saving} message={message} saveItem={saveItem} cancel={() => { setFormOpen(false); setEditingId(null); setForm(emptyForm); }} groups={vault.groups} /></ScrollView></View></View> : null}"

if old in s:
    s = s.replace(old, new)
else:
    old2 = "{formOpen ? <VaultForm mode={mode} form={form} set={set} save={save} cancel={() => setFormOpen(false)} groups={vault.groups} /> : null}"
    new2 = "{formOpen ? <View style={styles.modalOverlay}><View style={styles.modalSheet}><ScrollView showsVerticalScrollIndicator={false}><VaultForm mode={mode} form={form} set={set} save={save} cancel={() => setFormOpen(false)} groups={vault.groups} /></ScrollView></View></View> : null}"
    s = s.replace(old2, new2)

# Replace bottom-sheet positioning with a higher centered floating modal.
s = s.replace("justifyContent: 'flex-end'", "justifyContent: 'flex-start'")
s = s.replace("justifyContent:'flex-end'", "justifyContent:'flex-start'")
s = s.replace("padding: 14", "paddingTop: 88, paddingHorizontal: 14, paddingBottom: 14")
s = s.replace("padding:14", "paddingTop:88,paddingHorizontal:14,paddingBottom:14")
s = s.replace("maxHeight: '88%'", "maxHeight: '76%'")
s = s.replace("maxHeight:'88%'", "maxHeight:'76%'")

if 'modalOverlay:' not in s:
    marker = "container: { padding: 18, paddingTop: 12, paddingBottom: 44 },"
    addition = "container: { padding: 18, paddingTop: 12, paddingBottom: 44 }, modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-start', paddingTop: 88, paddingHorizontal: 14, paddingBottom: 14 }, modalSheet: { maxHeight: '76%', backgroundColor: '#fff', borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' }, selectedBankBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, marginTop: 8 }, selectedBankText: { color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 16 },"
    s = s.replace(marker, addition)
    marker2 = "container:{padding:18,paddingBottom:44},"
    addition2 = "container:{padding:18,paddingBottom:44},modalOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:60,backgroundColor:'rgba(15,23,42,0.35)',justifyContent:'flex-start',paddingTop:88,paddingHorizontal:14,paddingBottom:14},modalSheet:{maxHeight:'76%',backgroundColor:'#fff',borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},selectedBankBox:{backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:14,marginTop:8},selectedBankText:{color:'#0f172a',fontWeight:'900',textAlign:'right',fontSize:16},"
    s = s.replace(marker2, addition2)
else:
    if 'selectedBankBox:' not in s:
        s = s.replace("modalSheet: { maxHeight: '76%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },", "modalSheet: { maxHeight: '76%', backgroundColor: '#fff', borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' }, selectedBankBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, marginTop: 8 }, selectedBankText: { color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 16 },")
        s = s.replace("modalSheet:{maxHeight:'76%',backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},", "modalSheet:{maxHeight:'76%',backgroundColor:'#fff',borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},selectedBankBox:{backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:14,marginTop:8},selectedBankText:{color:'#0f172a',fontWeight:'900',textAlign:'right',fontSize:16},")

# Hide bank choices inside add/edit forms. Show only the selected bank name.
old_bank_picker = "<><Text style={styles.inputLabel}>البنك</Text><PickerRow options={groups.map((group) => ({ value: groupRef(group), label: bankLabel(group.displayName) }))} value={form.owner_group} onChange={(value) => setField('owner_group', value)} /></>"
new_bank_label = "<><Text style={styles.inputLabel}>البنك</Text><View style={styles.selectedBankBox}><Text style={styles.selectedBankText}>{selectedBankName(groups, form.owner_group)}</Text></View></>"
s = s.replace(old_bank_picker, new_bank_label)
old_bank_picker2 = "<><Text style={styles.label}>البنك</Text><View style={styles.chips}>{groups.map((g) => <TouchableOpacity key={g.key} style={[styles.chip, form.owner_group === groupRef(g) && styles.chipActive]} onPress={() => set('owner_group', groupRef(g))}><Text style={[styles.chipText, form.owner_group === groupRef(g) && styles.chipTextActive]}>{g.name}</Text></TouchableOpacity>)}</View></>"
new_bank_label2 = "<><Text style={styles.label}>البنك</Text><View style={styles.selectedBankBox}><Text style={styles.selectedBankText}>{selectedBankName(groups, form.owner_group)}</Text></View></>"
s = s.replace(old_bank_picker2, new_bank_label2)

if 'function selectedBankName' not in s:
    helper = "\nfunction selectedBankName(groups, value) { const found = groups.find((g) => groupRef(g) === value || String(g.bank?.id || '') === String(value || '') || normalizeText(g.displayName || g.name) === normalizeText(value)); return bankLabel(found?.displayName || found?.name || value || 'غير محدد'); }\n"
    if 'function buildVault' in s:
        s = s.replace('\nfunction buildVault', helper + '\nfunction buildVault')
    elif 'function groupItems' in s:
        s = s.replace('\nfunction groupItems', helper + '\nfunction groupItems')

p.write_text(s, encoding='utf-8')
print('secure vault floating form adjusted upward and bank picker hidden')
