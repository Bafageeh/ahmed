from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

# date_only is a special state for editing a receipt date only.
# It must display as active and must not fall through to the overdue rule.
old = """function statusOf(item) {\n  if (item?.status === 'received' || item?.status === 'completed') return { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' };\n  if (item?.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', color: '#7c3aed', bg: '#f5f3ff' };\n  if (item?.maturity_date && item.maturity_date < today()) return { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' };\n  return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };\n}"""
new = """function statusOf(item) {\n  if (item?.status === 'received' || item?.status === 'completed') return { key: 'received', label: 'مستلم', color: '#2563eb', bg: '#eff6ff' };\n  if (item?.status === 'partial_received') return { key: 'partial_received', label: 'مستلم جزئيًا', color: '#7c3aed', bg: '#f5f3ff' };\n  if (item?.status === 'date_only') return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };\n  if (item?.maturity_date && item.maturity_date < today()) return { key: 'overdue', label: 'متأخر', color: '#dc2626', bg: '#fef2f2' };\n  return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };\n}"""
if old in text:
    text = text.replace(old, new, 1)

old = """    setSavingReceiptDateId(receipt.id);\n    try {\n      await apiJson(`/ta3meed/receipts/${receipt.id}`, {"""
new = """    const currentItem = items.find((candidate) => String(candidate.id) === String(receipt.opportunity_id));\n\n    setSavingReceiptDateId(receipt.id);\n    try {\n      await apiJson(`/ta3meed/receipts/${receipt.id}`, {"""
if old in text and "const currentItem = items.find((candidate) => String(candidate.id) === String(receipt.opportunity_id));" not in text and "const currentItem = ownerItem || items.find" not in text:
    text = text.replace(old, new, 1)

old = """        body: JSON.stringify({ receipt_date: date, notes: receipt.notes || null }),"""
new = """        body: JSON.stringify({\n          receipt_date: date,\n          notes: receipt.notes || null,\n        }),"""
if old in text:
    text = text.replace(old, new, 1)

old = """      setMessage('تم تعديل تاريخ الدفعة وإعادة حساب الفرصة');\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');\n      await load(true);"""
new = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setItems((currentItems) => currentItems.map((item) => {\n        if (String(item.id) !== String(receipt.opportunity_id)) return item;\n        return {\n          ...item,\n          status: 'date_only',\n          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),\n          allocations: (item.allocations || []).map((allocation) => ({ ...allocation, status: 'date_only' })),\n        };\n      }));\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');"""
if old in text:
    text = text.replace(old, new, 1)

old = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setItems((currentItems) => currentItems.map((item) => {\n        if (String(item.id) !== String(receipt.opportunity_id)) return item;\n        return {\n          ...item,\n          status: 'active',\n          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),\n          allocations: (item.allocations || []).map((allocation) => ({ ...allocation, status: 'active' })),\n        };\n      }));\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');"""
new = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setItems((currentItems) => currentItems.map((item) => {\n        if (String(item.id) !== String(receipt.opportunity_id)) return item;\n        return {\n          ...item,\n          status: 'date_only',\n          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),\n          allocations: (item.allocations || []).map((allocation) => ({ ...allocation, status: 'date_only' })),\n        };\n      }));\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');"""
if old in text:
    text = text.replace(old, new, 1)

# Make card calls robust: pass the owning item when a receipt save button calls saveReceiptDate.
text = text.replace("saveReceiptDate(receipt)", "saveReceiptDate(receipt, item)")
text = text.replace("onPress={() => saveReceiptDate(receipt)}", "onPress={() => saveReceiptDate(receipt, item)}")

# Accept the optional item argument and prefer it when available.
text = text.replace(
    "const saveReceiptDate = async (receipt) => {",
    "const saveReceiptDate = async (receipt, ownerItem = null) => {",
)
text = text.replace(
    "const currentItem = items.find((candidate) => String(candidate.id) === String(receipt.opportunity_id));",
    "const currentItem = ownerItem || items.find((candidate) => String(candidate.id) === String(receipt.opportunity_id));",
)

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed receipt date status preservation")
else:
    print("Ta3meed receipt date status preservation already patched")
