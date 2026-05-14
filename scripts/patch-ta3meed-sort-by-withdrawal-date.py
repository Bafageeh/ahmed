from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

helper = """
function withdrawalSortValue(item) {
  const meta = metaOf(item);
  const dateText = String(
    meta.withdrawal_date ||
    item.withdrawal_date ||
    item.investment_date ||
    item.start_date ||
    item.created_at ||
    ''
  ).slice(0, 10);
  const value = dateText ? new Date(`${dateText}T00:00:00`).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}
"""

if "function withdrawalSortValue" not in text:
    anchor = "function formatRealInvestmentDuration(days) {"
    if anchor in text:
        text = text.replace(anchor, helper + "\n" + anchor, 1)

old = """    return items.filter((item) => {
      const status = statusOf(item).key;
      const category = categoryOf(item);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (!itemHasInvestor(item, investorFilter)) return false;
      if (!keyword) return true;
      const meta = metaOf(item);
      const text = [
        item.reference_number,
        item.status,
        item.maturity_date,
        meta.category,
        category,
        meta.withdrawal_date,
        ...(item.allocations || []).map((allocation) => allocation.investor_name),
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(keyword);
    });"""

new = """    return items.filter((item) => {
      const status = statusOf(item).key;
      const category = categoryOf(item);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;
      if (!itemHasInvestor(item, investorFilter)) return false;
      if (!keyword) return true;
      const meta = metaOf(item);
      const text = [
        item.reference_number,
        item.status,
        item.maturity_date,
        meta.category,
        category,
        meta.withdrawal_date,
        ...(item.allocations || []).map((allocation) => allocation.investor_name),
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(keyword);
    }).sort((a, b) => withdrawalSortValue(b) - withdrawalSortValue(a));"""

if old in text:
    text = text.replace(old, new, 1)

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed sorting by newest withdrawal date")
else:
    print("Ta3meed sorting by withdrawal date already patched")
