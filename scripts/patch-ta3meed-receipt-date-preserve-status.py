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
new = """        body: JSON.stringify({\n          receipt_date: date,\n          notes: receipt.notes || null,\n          preserve_status: currentItem?.status || null,\n        }),"""
if old in text:
    text = text.replace(old, new, 1)

text = text.replace(
    "setMessage('تم تعديل تاريخ الدفعة وإعادة حساب الفرصة');",
    "setMessage('تم تعديل تاريخ الدفعة فقط بدون تغيير حالة الفرصة');",
)

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed receipt date status preservation")
else:
    print("Ta3meed receipt date status preservation already patched")
