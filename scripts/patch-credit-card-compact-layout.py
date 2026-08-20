#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/CreditCardDebtsScreen.js')
text = path.read_text(encoding='utf-8')

replacements = {
    '<BankLogo bankName={item.bank_name} size={40} />': '<BankLogo bankName={item.bank_name} size={32} />',
    "  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 124 },": "  content: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 108 },",
    "  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, gap: 10 },": "  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8, gap: 8 },",
    "  sectionCount: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#efe9ff', alignItems: 'center', justifyContent: 'center' },": "  sectionCount: { minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 17, backgroundColor: '#efe9ff', alignItems: 'center', justifyContent: 'center' },",
    "  sectionCountText: { color: '#6d28d9', fontSize: 15, fontWeight: '900' },": "  sectionCountText: { color: '#6d28d9', fontSize: 13, fontWeight: '900' },",
    "  sectionTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'right' },": "  sectionTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },",
    "  sectionSubtitle: { marginTop: 2, color: '#94a3b8', fontSize: 10, fontWeight: '800', textAlign: 'right' },": "  sectionSubtitle: { marginTop: 1, color: '#94a3b8', fontSize: 9, fontWeight: '800', textAlign: 'right' },",
    "  creditCard: { backgroundColor: '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: '#dbe3ea', padding: 16, marginBottom: 13 },": "  creditCard: { backgroundColor: '#ffffff', borderRadius: 18, borderWidth: 1, borderColor: '#dbe3ea', padding: 11, marginBottom: 9 },",
    "  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },": "  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },",
    "  cardName: { color: '#0f172a', fontSize: 23, fontWeight: '900', textAlign: 'right' },": "  cardName: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },",
    "  bankName: { marginTop: 3, color: '#64748b', fontSize: 14, fontWeight: '800', textAlign: 'right' },": "  bankName: { marginTop: 1, color: '#64748b', fontSize: 12, fontWeight: '800', textAlign: 'right' },",
    "  cardIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },": "  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },",
    "  limitRow: { marginTop: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13 },": "  limitRow: { marginTop: 9, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 9 },",
    "  limitValue: { color: '#312e81', fontSize: 20, fontWeight: '900', textAlign: 'right' },": "  limitValue: { color: '#312e81', fontSize: 18, fontWeight: '900', textAlign: 'right' },",
    "  limitLabel: { marginTop: 3, color: '#64748b', fontSize: 10, fontWeight: '800', textAlign: 'right' },": "  limitLabel: { marginTop: 1, color: '#64748b', fontSize: 9, fontWeight: '800', textAlign: 'right' },",
    "  limitPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#ede9fe' },": "  limitPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#ede9fe' },",
    "  limitPillText: { color: '#6d28d9', fontSize: 10, fontWeight: '900' },": "  limitPillText: { color: '#6d28d9', fontSize: 9, fontWeight: '900' },",
    "  cardFooter: { marginTop: 12, flexDirection: 'row-reverse', gap: 9 },": "  cardFooter: { marginTop: 8, flexDirection: 'row-reverse', gap: 7 },",
    "  actionButton: { flex: 1, minHeight: 42, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },": "  actionButton: { flex: 1, minHeight: 36, borderRadius: 11, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },",
    "  actionText: { color: '#475569', fontSize: 13, fontWeight: '900' },": "  actionText: { color: '#475569', fontSize: 12, fontWeight: '900' },",
    "  deleteText: { color: '#b91c1c', fontSize: 13, fontWeight: '900' },": "  deleteText: { color: '#b91c1c', fontSize: 12, fontWeight: '900' },",
    "  floatingAdd: { position: 'absolute', left: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#312e81', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },": "  floatingAdd: { position: 'absolute', left: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#312e81', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },",
}

missing = []
for old, new in replacements.items():
    if old not in text:
        missing.append(old[:90])
    else:
        text = text.replace(old, new, 1)

if missing:
    raise SystemExit('Compact credit-card patch could not find expected source fragments:\n- ' + '\n- '.join(missing))

marker = "// compact-credit-card-layout-v1"
if marker not in text:
    text = text.replace("const androidTopInset =", f"{marker}\nconst androidTopInset =", 1)

path.write_text(text, encoding='utf-8')
print('Applied compact credit-card debt layout.')
