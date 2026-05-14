from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(1)

text = PATH.read_text(encoding="utf-8")
original = text

fn_start = text.find("function Ta3meedCard(")
if fn_start == -1:
    print("Ta3meedCard function not found")
    raise SystemExit(1)

brace_start = text.find("{", fn_start)
if brace_start == -1:
    print("Ta3meedCard opening brace not found")
    raise SystemExit(1)

level = 0
fn_end = -1
for idx in range(brace_start, len(text)):
    ch = text[idx]
    if ch == "{":
        level += 1
    elif ch == "}":
        level -= 1
        if level == 0:
            fn_end = idx + 1
            break

if fn_end == -1:
    print("Ta3meedCard closing brace not found")
    raise SystemExit(1)

block = text[fn_start:fn_end]

if "ta3meedCardInvestorBadges" in block:
    print("Ta3meedCard investor badges already patched")
    raise SystemExit(0)

return_pos = block.find("return (")
if return_pos == -1:
    print("Ta3meedCard return block not found")
    raise SystemExit(1)

badge_code = r'''
  const ta3meedCardInvestorBadges = (item.allocations || []).length ? (
    <View style={styles.investorBadgesBox}>
      <View style={styles.investorBadgesHeader}>
        <Text style={styles.investorBadgesCount}>{(item.allocations || []).length} مستثمر</Text>
        <Text style={styles.investorBadgesTitle}>المستثمرين</Text>
      </View>
      <View style={styles.investorBadgesWrap}>
        {(item.allocations || []).map((allocation, index) => {
          const investorName = allocation.investor_name || allocation.investor_code || 'مستثمر';
          const invested = n(allocation.invested_amount);
          const received = n(allocation.received_amount);
          const remaining = Math.max(0, invested - Math.min(invested, received));
          return (
            <View key={`ta3meed-investor-badge-${allocation.id || index}`} style={styles.investorBadge}>
              <Text style={styles.investorBadgeName} numberOfLines={1}>{investorName}</Text>
              <Text style={styles.investorBadgeAmount}>{money(remaining, 0)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  ) : null;

'''

block = block[:return_pos] + badge_code + block[return_pos:]

# Insert badge as the first visible child inside the card root.
return_pos = block.find("return (")
child_marker = "\n      <View"
insert_pos = block.find(child_marker, return_pos)
if insert_pos == -1:
    # fallback: insert before the details button text if present
    detail_text = "تفاصيل وسجل الدفعات"
    insert_pos = block.find(detail_text, return_pos)
    if insert_pos != -1:
        # move to start of the surrounding line
        insert_pos = block.rfind("\n", 0, insert_pos)

if insert_pos == -1:
    print("Could not find a safe insertion point inside Ta3meedCard")
    raise SystemExit(1)

block = block[:insert_pos] + "\n      {ta3meedCardInvestorBadges}" + block[insert_pos:]

text = text[:fn_start] + block + text[fn_end:]

styles_marker = "const styles = StyleSheet.create({"
styles_pos = text.find(styles_marker)
if styles_pos == -1:
    print("StyleSheet block not found")
    raise SystemExit(1)

style_code = r'''
  investorBadgesBox: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  investorBadgesHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  investorBadgesTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  investorBadgesCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  investorBadgesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  investorBadge: {
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ea',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  investorBadgeName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
  },
  investorBadgeAmount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
'''

if "investorBadgesBox:" not in text:
    text = text.replace(styles_marker, styles_marker + "\n" + style_code, 1)

PATH.write_text(text, encoding="utf-8")
print("patched direct Ta3meedCard investor badges")
