from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedScreen.js"

if not PATH.exists():
    print("Ta3meedScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

if "receiptMessage" not in text:
    text = text.replace(
        "  const [searchVisible, setSearchVisible] = useState(false);\n  const [search, setSearch] = useState('');",
        "  const [searchVisible, setSearchVisible] = useState(false);\n  const [search, setSearch] = useState('');\n  const [receiptMessage, setReceiptMessage] = useState('');\n  const [receiptPreview, setReceiptPreview] = useState(null);\n  const [receiptSaving, setReceiptSaving] = useState(false);",
    )

if "status === 'partial_received'" not in text:
    text = text.replace(
        "function getStatus(item) {\n  if (isReceived(item)) return { key: 'received', label: 'مستلم', style: 'received' };\n  if (isOverdue(item)) return { key: 'overdue', label: 'متأخر', style: 'overdue' };\n  return { key: 'active', label: 'نشط', style: 'active' };\n}",
        "function getStatus(item) {\n  if (isReceived(item)) return { key: 'received', label: 'مستلم', style: 'received' };\n  if (item.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', style: 'partial' };\n  if (isOverdue(item)) return { key: 'overdue', label: 'متأخر', style: 'overdue' };\n  return { key: 'active', label: 'نشط', style: 'active' };\n}",
    )

if "partial_received" not in text.split("const statusFilters = [", 1)[1].split("];", 1)[0]:
    text = text.replace(
        "  { key: 'overdue', label: 'متأخر', dot: '#f97316' },\n  { key: 'received', label: 'مستلم', dot: '#2563eb' },",
        "  { key: 'overdue', label: 'متأخر', dot: '#f97316' },\n  { key: 'partial_received', label: 'جزئي', dot: '#7c3aed' },\n  { key: 'received', label: 'مستلم', dot: '#2563eb' },",
    )

if "const parseReceiptMessage = async" not in text:
    text = text.replace(
        "  const cycleFilter = () => {\n    const currentIndex = statusFilters.findIndex((filter) => filter.key === statusFilter);\n    const next = statusFilters[(currentIndex + 1) % statusFilters.length];\n    setStatusFilter(next.key);\n  };",
        "  const cycleFilter = () => {\n    const currentIndex = statusFilters.findIndex((filter) => filter.key === statusFilter);\n    const next = statusFilters[(currentIndex + 1) % statusFilters.length];\n    setStatusFilter(next.key);\n  };\n\n  const parseReceiptMessage = async () => {\n    if (!receiptMessage.trim()) return setMessage('الصق رسالة تعميد أولًا');\n    setReceiptPreview(null);\n    setMessage('جاري تحليل رسالة تعميد...');\n    try {\n      const response = await fetch(`${API_URL}/ta3meed/receipts/parse`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },\n        body: JSON.stringify({ message: receiptMessage }),\n      });\n      const json = await response.json();\n      if (!response.ok) throw new Error(json.message || 'parse failed');\n      setReceiptPreview(json.data);\n      setMessage('تم تحليل الرسالة. راجع الملخص ثم اعتمد الدفعة.');\n    } catch (error) {\n      setMessage(error.message || 'تعذر تحليل رسالة تعميد');\n    }\n  };\n\n  const applyReceiptMessage = async () => {\n    if (!receiptMessage.trim()) return setMessage('الصق رسالة تعميد أولًا');\n    setReceiptSaving(true);\n    setMessage('جاري اعتماد دفعة تعميد...');\n    try {\n      const response = await fetch(`${API_URL}/ta3meed/receipts/apply-message`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },\n        body: JSON.stringify({ message: receiptMessage }),\n      });\n      const json = await response.json();\n      if (!response.ok) throw new Error(json.message || 'save failed');\n      setReceiptPreview(json.data?.parsed || null);\n      setReceiptMessage('');\n      setMessage('تم اعتماد الدفعة وتوزيعها على المستثمرين');\n      await loadData();\n    } catch (error) {\n      setMessage(error.message || 'تعذر اعتماد دفعة تعميد');\n    } finally {\n      setReceiptSaving(false);\n    }\n  };",
    )

if "<ReceiptMessageCard" not in text:
    text = text.replace(
        "        {!!message && <Text style={styles.message}>{message}</Text>}",
        "        {tab === 'investments' ? (\n          <ReceiptMessageCard\n            receiptMessage={receiptMessage}\n            setReceiptMessage={setReceiptMessage}\n            preview={receiptPreview}\n            onParse={parseReceiptMessage}\n            onApply={applyReceiptMessage}\n            saving={receiptSaving}\n          />\n        ) : null}\n\n        {!!message && <Text style={styles.message}>{message}</Text>}",
    )

if "function ReceiptMessageCard" not in text:
    marker = "function InvestorStats({ summary }) {"
    component = r'''
function ReceiptMessageCard({ receiptMessage, setReceiptMessage, preview, onParse, onApply, saving }) {
  return (
    <View style={styles.receiptCard}>
      <View style={styles.sectionHeaderInline}>
        <Text style={styles.cardTitle}>لصق رسالة استلام تعميد</Text>
        <Text style={styles.cardBadge}>🔍</Text>
      </View>
      <Text style={styles.cardText}>الصق رسالة السداد من تعميد، وسيتم استخراج رقم الفرصة والمبلغ ونوع السداد تلقائيًا.</Text>
      <TextInput
        value={receiptMessage}
        onChangeText={setReceiptMessage}
        style={[styles.input, styles.receiptInput]}
        multiline
        placeholder={'مثال: تم إضافة سداد جزئي بقيمة 3741.53 للفرصة رقم ER-TIQX836'}
        placeholderTextColor="#94a3b8"
        textAlign="right"
      />
      {preview ? (
        <View style={styles.receiptPreview}>
          <Text style={styles.receiptPreviewTitle}>ملخص القراءة</Text>
          <Text style={styles.receiptPreviewText}>رقم الفرصة: {preview.reference_number || '-'}</Text>
          <Text style={styles.receiptPreviewText}>المبلغ: {formatMoney(preview.amount || 0, 2)}</Text>
          <Text style={styles.receiptPreviewText}>النوع: {preview.label || '-'}</Text>
          <Text style={styles.receiptPreviewText}>الإغلاق: {preview.is_final ? 'يغلق البطاقة كمستلمة بالكامل' : 'دفعة جزئية ولا يغلق البطاقة'}</Text>
        </View>
      ) : null}
      <View style={styles.receiptActionsRow}>
        <TouchableOpacity style={styles.receiptSecondaryButton} onPress={onParse} activeOpacity={0.85}>
          <Text style={styles.receiptSecondaryText}>تحليل الرسالة</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.receiptPrimaryButton, saving && styles.disabledAction]} onPress={onApply} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.receiptPrimaryText}>{saving ? 'جاري الاعتماد...' : 'اعتماد الدفعة'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

'''
    text = text.replace(marker, component + marker)

if "ta3meed_received_total" not in text:
    text = text.replace(
        "  const status = getStatus(item);\n  const received = status.key === 'received';",
        "  const status = getStatus(item);\n  const received = status.key === 'received';\n  const receivedTotal = asNumber(meta.ta3meed_received_total);\n  const remainingAmount = asNumber(meta.ta3meed_remaining_amount);\n  const settlementDiff = asNumber(meta.ta3meed_settlement_difference);\n  const receipts = Array.isArray(item.receipts) ? item.receipts : [];",
    )

if "المستلم" not in text[text.find("function Ta3meedCard"):text.find("function StatusPill")]:
    text = text.replace(
        "      {expanded ? (\n        <View style={styles.detailsBox}>\n          <Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>",
        "      {expanded ? (\n        <View style={styles.detailsBox}>\n          <Text style={styles.detailText}>المستلم: {formatMoney(receivedTotal, 2)}</Text>\n          <Text style={styles.detailText}>المتبقي: {formatMoney(remainingAmount, 2)}</Text>\n          {settlementDiff !== 0 ? <Text style={styles.detailText}>فرق التسوية: {formatMoney(settlementDiff, 2)}</Text> : null}\n          <Text style={styles.detailText}>تاريخ السحب: {meta.withdrawal_date || item.start_date || '-'}</Text>",
    )

if "سجل الدفعات" not in text:
    text = text.replace(
        "          {allocations.length ? (\n            <View style={styles.allocBox}>",
        "          {receipts.length ? (\n            <View style={styles.allocBox}>\n              <Text style={styles.allocTitle}>سجل الدفعات</Text>\n              {receipts.map((receipt) => (\n                <Text key={receipt.id} style={styles.allocText}>{receipt.receipt_date || '-'} · {receipt.receipt_type === 'full' ? 'سداد كلي' : 'سداد جزئي'} · {formatMoney(receipt.amount, 2)}</Text>\n              ))}\n            </View>\n          ) : null}\n          {allocations.length ? (\n            <View style={styles.allocBox}>",
    )

# Append styles safely before the StyleSheet closes.
style_inserts = {
    "receiptCard": "  receiptCard: { marginTop: 12, backgroundColor: '#ffffff', borderRadius: 22, padding: 13, borderWidth: 1, borderColor: '#dbe7e5' },",
    "receiptInput": "  receiptInput: { minHeight: 86, textAlignVertical: 'top', marginTop: 10 },",
    "receiptPreview": "  receiptPreview: { marginTop: 10, backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },",
    "receiptPreviewTitle": "  receiptPreviewTitle: { color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 6 },",
    "receiptPreviewText": "  receiptPreviewText: { color: '#334155', fontWeight: '800', textAlign: 'right', marginTop: 3 },",
    "receiptActionsRow": "  receiptActionsRow: { marginTop: 10, flexDirection: 'row-reverse', gap: 8 },",
    "receiptPrimaryButton": "  receiptPrimaryButton: { flex: 1, backgroundColor: '#0f766e', borderRadius: 15, paddingVertical: 12, alignItems: 'center' },",
    "receiptPrimaryText": "  receiptPrimaryText: { color: '#ffffff', fontWeight: '900' },",
    "receiptSecondaryButton": "  receiptSecondaryButton: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 15, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },",
    "receiptSecondaryText": "  receiptSecondaryText: { color: '#0f172a', fontWeight: '900' },",
    "partialPill": "  partialPill: { backgroundColor: '#ede9fe', color: '#6d28d9' },",
}
for key, line in style_inserts.items():
    if f"  {key}:" not in text:
        idx = text.rfind("});")
        if idx != -1:
            text = text[:idx] + line + "\n" + text[idx:]

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed receipts UI")
else:
    print("Ta3meed receipts UI already patched")
