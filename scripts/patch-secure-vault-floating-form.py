from pathlib import Path
import re

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

# Force floating modal higher.
s = s.replace("justifyContent: 'flex-end'", "justifyContent: 'flex-start'")
s = s.replace("justifyContent:'flex-end'", "justifyContent:'flex-start'")
s = s.replace("padding: 14", "paddingTop: 70, paddingHorizontal: 14, paddingBottom: 14")
s = s.replace("padding:14", "paddingTop:70,paddingHorizontal:14,paddingBottom:14")
s = s.replace("paddingTop: 88", "paddingTop: 70")
s = s.replace("paddingTop:88", "paddingTop:70")
s = s.replace("maxHeight: '88%'", "maxHeight: '78%'")
s = s.replace("maxHeight:'88%'", "maxHeight:'78%'")
s = s.replace("maxHeight: '76%'", "maxHeight: '78%'")
s = s.replace("maxHeight:'76%'", "maxHeight:'78%'")

if 'modalOverlay:' not in s:
    marker = "container: { padding: 18, paddingTop: 12, paddingBottom: 44 },"
    addition = "container: { padding: 18, paddingTop: 12, paddingBottom: 44 }, modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-start', paddingTop: 70, paddingHorizontal: 14, paddingBottom: 14 }, modalSheet: { maxHeight: '78%', backgroundColor: '#fff', borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' }, selectedBankBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, marginTop: 8 }, selectedBankText: { color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 16 },"
    s = s.replace(marker, addition)
    marker2 = "container:{padding:18,paddingBottom:44},"
    addition2 = "container:{padding:18,paddingBottom:44},modalOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:60,backgroundColor:'rgba(15,23,42,0.35)',justifyContent:'flex-start',paddingTop:70,paddingHorizontal:14,paddingBottom:14},modalSheet:{maxHeight:'78%',backgroundColor:'#fff',borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},selectedBankBox:{backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:14,marginTop:8},selectedBankText:{color:'#0f172a',fontWeight:'900',textAlign:'right',fontSize:16},"
    s = s.replace(marker2, addition2)

# Add selected bank styles even if modal styles already existed.
if 'selectedBankBox:' not in s:
    s = s.replace("modalSheet: { maxHeight: '78%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },", "modalSheet: { maxHeight: '78%', backgroundColor: '#fff', borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' }, selectedBankBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, marginTop: 8 }, selectedBankText: { color: '#0f172a', fontWeight: '900', textAlign: 'right', fontSize: 16 },")
    s = s.replace("modalSheet:{maxHeight:'78%',backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},", "modalSheet:{maxHeight:'78%',backgroundColor:'#fff',borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},selectedBankBox:{backgroundColor:'#f8fafc',borderWidth:1,borderColor:'#e2e8f0',borderRadius:16,padding:14,marginTop:8},selectedBankText:{color:'#0f172a',fontWeight:'900',textAlign:'right',fontSize:16},")

# Remove any bank chip picker block, even after bank/site lite patch changes the function shape.
replacement = "<><Text style={styles.inputLabel}>البنك</Text><View style={styles.selectedBankBox}><Text style={styles.selectedBankText}>{selectedBankName(groups, form.owner_group)}</Text></View></>"
pattern = r"<><Text style=\{styles\.inputLabel\}>البنك</Text><PickerRow[\s\S]*?</>"
s = re.sub(pattern, replacement, s, count=1)
replacement2 = "<><Text style={styles.label}>البنك</Text><View style={styles.selectedBankBox}><Text style={styles.selectedBankText}>{selectedBankName(groups, form.owner_group)}</Text></View></>"
pattern2 = r"<><Text style=\{styles\.label\}>البنك</Text><View style=\{styles\.chips\}>[\s\S]*?</View></>"
s = re.sub(pattern2, replacement2, s, count=1)

# If chips block remains, hide it visually and prevent bank choice use in modal.
s = s.replace("<View style={styles.chips}>{groups.map((g) =>", "<View style={{display:'none'}}>{groups.map((g) =>")

if 'function selectedBankName' not in s:
    helper = "\nfunction selectedBankName(groups, value) { const found = groups.find((g) => groupRef(g) === value || String(g.bank?.id || '') === String(value || '') || normalizeText(g.displayName || g.name) === normalizeText(value)); return bankLabel(found?.displayName || found?.name || value || 'غير محدد'); }\n"
    if 'function buildVault' in s:
        s = s.replace('\nfunction buildVault', helper + '\nfunction buildVault')
    elif 'function groupItems' in s:
        s = s.replace('\nfunction groupItems', helper + '\nfunction groupItems')

p.write_text(s, encoding='utf-8')
print('secure vault modal forced upward and bank picker removed')
