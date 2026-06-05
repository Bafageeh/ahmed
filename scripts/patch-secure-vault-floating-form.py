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

if 'modalOverlay:' not in s:
    marker = "container: { padding: 18, paddingTop: 12, paddingBottom: 44 },"
    addition = "container: { padding: 18, paddingTop: 12, paddingBottom: 44 }, modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end', padding: 14 }, modalSheet: { maxHeight: '88%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderRadius: 28, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },"
    s = s.replace(marker, addition)
    marker2 = "container:{padding:18,paddingBottom:44},"
    addition2 = "container:{padding:18,paddingBottom:44},modalOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:60,backgroundColor:'rgba(15,23,42,0.35)',justifyContent:'flex-end',padding:14},modalSheet:{maxHeight:'88%',backgroundColor:'#fff',borderTopLeftRadius:28,borderTopRightRadius:28,borderRadius:28,padding:12,borderWidth:1,borderColor:'#e2e8f0'},"
    s = s.replace(marker2, addition2)

p.write_text(s, encoding='utf-8')
print('secure vault floating add/edit form patch applied')
