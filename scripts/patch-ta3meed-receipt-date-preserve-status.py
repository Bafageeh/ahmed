from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

old = """    setSavingReceiptDateId(receipt.id);\n    try {\n      await apiJson(`/ta3meed/receipts/${receipt.id}`, {"""
new = """    const currentItem = items.find((candidate) => String(candidate.id) === String(receipt.opportunity_id));\n\n    setSavingReceiptDateId(receipt.id);\n    try {\n      await apiJson(`/ta3meed/receipts/${receipt.id}`, {"""
if old in text and "const currentItem = items.find((candidate) => String(candidate.id) === String(receipt.opportunity_id));" not in text:
    text = text.replace(old, new, 1)

old = """        body: JSON.stringify({ receipt_date: date, notes: receipt.notes || null }),"""
new = """        body: JSON.stringify({\n          receipt_date: date,\n          notes: receipt.notes || null,\n          preserve_status: 'active',\n        }),"""
if old in text:
    text = text.replace(old, new, 1)

old = """        body: JSON.stringify({\n          receipt_date: date,\n          notes: receipt.notes || null,\n          preserve_status: currentItem?.status || null,\n        }),"""
new = """        body: JSON.stringify({\n          receipt_date: date,\n          notes: receipt.notes || null,\n          preserve_status: 'active',\n        }),"""
if old in text:
    text = text.replace(old, new, 1)

old = """      setMessage('تم تعديل تاريخ الدفعة وإعادة حساب الفرصة');\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');\n      await load(true);"""
new = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setItems((currentItems) => currentItems.map((item) => {\n        if (String(item.id) !== String(receipt.opportunity_id)) return item;\n        return {\n          ...item,\n          status: 'active',\n          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),\n          allocations: (item.allocations || []).map((allocation) => ({ ...allocation, status: 'active' })),\n        };\n      }));\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');"""
if old in text:
    text = text.replace(old, new, 1)

old = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');\n      await load(true);"""
new = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setItems((currentItems) => currentItems.map((item) => {\n        if (String(item.id) !== String(receipt.opportunity_id)) return item;\n        return {\n          ...item,\n          status: 'active',\n          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),\n          allocations: (item.allocations || []).map((allocation) => ({ ...allocation, status: 'active' })),\n        };\n      }));\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');"""
if old in text and "currentItems) => currentItems.map" not in text[text.find("const saveReceiptDate"):text.find("const openOpportunityEdit")]:
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
