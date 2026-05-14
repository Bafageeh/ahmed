from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedNoResetFilterScreen.js"

if not PATH.exists():
    print("Ta3meedNoResetFilterScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

start = text.find("function InlineEditableTa3meedCard(")
end = text.find("\nfunction isTa3meedCardElement", start)
if start == -1 or end == -1:
    print("InlineEditableTa3meedCard block not found")
    raise SystemExit(0)

new_block = r'''function InlineEditableTa3meedCard({ OriginalCard, cardProps, onEdit }) {
  const rendered = OriginalCard(cardProps);
  if (!rendered || !rendered.props) return rendered;

  const item = cardProps.item || {};
  const allocations = item.allocations || [];
  const existingChildren = rendered.props.children;
  const childArray = Array.isArray(existingChildren) ? existingChildren : [existingChildren];

  const investorBadges = allocations.length ? (
    <View key="ta3meed-investor-badges" style={{ marginTop: 10, marginBottom: 8, padding: 10, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: '#334155', fontSize: 12, fontWeight: '900', textAlign: 'right' }}>المستثمرين</Text>
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800' }}>{allocations.length} مستثمر</Text>
      </View>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>
        {allocations.map((allocation, index) => {
          const name = allocation.investor_name || allocation.investor_code || 'مستثمر';
          const amount = n(allocation.invested_amount);
          const received = n(allocation.received_amount);
          const remaining = Math.max(0, amount - Math.min(amount, received));
          return (
            <View key={`investor-badge-${allocation.id || index}`} style={{ maxWidth: '100%', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '900' }} numberOfLines={1}>{name}</Text>
              <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800' }}>{money(remaining, 0)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  ) : null;

  const editButton = (
    <TouchableOpacity
      key="inline-edit-opportunity"
      activeOpacity={0.84}
      onPress={() => onEdit(cardProps.item)}
      style={{ alignSelf: 'flex-start', marginTop: 10, width: 42, height: 42, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' }}
    >
      <UiIcon name="edit" size={22} color={ICON_COLOR_DARK} />
    </TouchableOpacity>
  );

  const nextChildren = childArray.length > 0
    ? [childArray[0], investorBadges, ...childArray.slice(1), editButton].filter(Boolean)
    : [investorBadges, editButton].filter(Boolean);

  return React.cloneElement(
    rendered,
    {
      ...rendered.props,
      style: [rendered.props.style, { borderRadius: 24, borderWidth: 1, borderColor: '#dbe7e5', backgroundColor: '#ffffff', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }],
    },
    ...nextChildren
  );
}
'''

text = text[:start] + new_block + text[end:]

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed investor badges and card layout")
else:
    print("Ta3meed investor badges already patched")
