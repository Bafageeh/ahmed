from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

# Update receipt date only. Do not change the opportunity status locally.
text = text.replace(
    "const saveReceiptDate = async (receipt) => {",
    "const saveReceiptDate = async (receipt, ownerItem = null) => {",
)

text = text.replace("saveReceiptDate(receipt)", "saveReceiptDate(receipt, item)")
text = text.replace("onPress={() => saveReceiptDate(receipt)}", "onPress={() => saveReceiptDate(receipt, item)}")

text = text.replace(
    """        body: JSON.stringify({ receipt_date: date, notes: receipt.notes || null }),""",
    """        body: JSON.stringify({\n          receipt_date: date,\n          notes: receipt.notes || null,\n        }),""",
)

old = """      setMessage('تم تعديل تاريخ الدفعة وإعادة حساب الفرصة');\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');\n      await load(true);"""
new = """      setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');\n      setItems((currentItems) => currentItems.map((item) => {\n        if (String(item.id) !== String(receipt.opportunity_id)) return item;\n        return {\n          ...item,\n          receipts: (item.receipts || []).map((row) => String(row.id) === String(receipt.id) ? { ...row, receipt_date: date, notes: receipt.notes || null } : row),\n        };\n      }));\n      setEditingReceiptId(null);\n      setEditingReceiptDate('');"""
text = text.replace(old, new)

text = text.replace("status: 'active',", "")
text = text.replace("status: 'date_only',", "")
text = text.replace("  if (item?.status === 'date_only') return { key: 'active', label: 'نشط', color: '#0f766e', bg: '#ecfdf5' };\n", "")

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed receipt date only without status change")
else:
    print("Ta3meed receipt date patch already clean")
