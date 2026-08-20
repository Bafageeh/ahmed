#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/CreditCardDebtsScreen.js')
text = path.read_text(encoding='utf-8')

old_render = '''        renderItem={({ item }) => (
          <View style={styles.creditCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardName}>{item.card_name}</Text>
                <Text style={styles.bankName}>{item.bank_name}</Text>
              </View>
              <View style={styles.cardIcon}>
                <BankLogo bankName={item.bank_name} size={40} />
              </View>
            </View>

            <View style={styles.limitRow}>
              <View style={styles.limitTextBlock}>
                <Text style={styles.limitValue}>{money(item.credit_limit)}</Text>
                <Text style={styles.limitLabel}>الحد المحتسب كدين</Text>
              </View>
              <View style={styles.limitPill}><Text style={styles.limitPillText}>حد ائتماني</Text></View>
            </View>

            <View style={styles.cardFooter}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEdit(item)} activeOpacity={0.82}>
                <UiIcon name="edit" size={18} color="#475569" />
                <Text style={styles.actionText}>تعديل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => remove(item)} activeOpacity={0.82}>
                <UiIcon name="delete" size={18} color="#b91c1c" />
                <Text style={styles.deleteText}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}'''

new_render = '''        renderItem={({ item }) => (
          <View style={styles.creditCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTextBlock}>
                <Text style={styles.cardName} numberOfLines={1}>{item.card_name}</Text>
                <Text style={styles.bankName} numberOfLines={1}>{item.bank_name}</Text>
              </View>
              <View style={styles.cardIcon}>
                <BankLogo bankName={item.bank_name} size={30} />
              </View>
            </View>

            <View style={styles.compactBottomRow}>
              <View style={styles.limitTextBlock}>
                <Text style={styles.limitValue}>{money(item.credit_limit)}</Text>
                <Text style={styles.limitLabel}>الحد الائتماني المحتسب كدين</Text>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openEdit(item)}
                  activeOpacity={0.82}
                  accessibilityLabel="تعديل البطاقة"
                >
                  <UiIcon name="edit" size={17} color="#475569" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => remove(item)}
                  activeOpacity={0.82}
                  accessibilityLabel="حذف البطاقة"
                >
                  <UiIcon name="delete" size={17} color="#b91c1c" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}'''

if old_render not in text:
    raise SystemExit('Compact v2 patch could not find the expected credit-card render block.')
text = text.replace(old_render, new_render, 1)

replacements = {
    "  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 124 },": "  content: { paddingHorizontal: 15, paddingTop: 2, paddingBottom: 96 },",
    "  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, gap: 10 },": "  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8, gap: 8 },",
    "  sectionCount: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#efe9ff', alignItems: 'center', justifyContent: 'center' },": "  sectionCount: { minWidth: 32, height: 32, paddingHorizontal: 8, borderRadius: 16, backgroundColor: '#efe9ff', alignItems: 'center', justifyContent: 'center' },",
    "  sectionCountText: { color: '#6d28d9', fontSize: 15, fontWeight: '900' },": "  sectionCountText: { color: '#6d28d9', fontSize: 12, fontWeight: '900' },",
    "  sectionTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right' },": "  sectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },",
    "  sectionSubtitle: { marginTop: 2, color: '#94a3b8', fontSize: 10, fontWeight: '800', textAlign: 'right' },": "  sectionSubtitle: { marginTop: 1, color: '#94a3b8', fontSize: 9, fontWeight: '800', textAlign: 'right' },",
    "  creditCard: { backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#dbe3ea', padding: 16, marginBottom: 13 },": "  creditCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe3ea', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },",
    "  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },": "  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },",
    "  cardName: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right' },": "  cardName: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },",
    "  bankName: { marginTop: 3, color: '#64748b', fontSize: 14, fontWeight: '800', textAlign: 'right' },": "  bankName: { marginTop: 1, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },",
    "  cardIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },": "  cardIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },",
    "  limitRow: { marginTop: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13 },": "  compactBottomRow: { marginTop: 7, paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eef2f7', flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },",
    "  limitValue: { color: '#312e81', fontSize: 20, fontWeight: '900', textAlign: 'right' },": "  limitValue: { color: '#312e81', fontSize: 17, fontWeight: '900', textAlign: 'right' },",
    "  limitLabel: { marginTop: 3, color: '#64748b', fontSize: 10, fontWeight: '800', textAlign: 'right' },": "  limitLabel: { marginTop: 1, color: '#64748b', fontSize: 8, fontWeight: '800', textAlign: 'right' },",
    "  cardFooter: { marginTop: 12, flexDirection: 'row-reverse', gap: 9 },": "  cardFooter: { flexDirection: 'row-reverse', gap: 6 },",
    "  actionButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },": "  actionButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },",
    "  floatingAdd: { position: 'absolute', left: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#312e81', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },": "  floatingAdd: { position: 'absolute', left: 18, bottom: 22, width: 54, height: 54, borderRadius: 27, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#312e81', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },",
}

missing = []
for old, new in replacements.items():
    if old not in text:
        missing.append(old[:110])
    else:
        text = text.replace(old, new, 1)

if missing:
    raise SystemExit('Compact v2 patch could not find expected source fragments:\n- ' + '\n- '.join(missing))

marker = "// compact-credit-card-layout-v2"
if marker not in text:
    text = text.replace("const androidTopInset =", f"{marker}\nconst androidTopInset =", 1)

path.write_text(text, encoding='utf-8')
print('Applied compact credit-card debt layout v2.')
