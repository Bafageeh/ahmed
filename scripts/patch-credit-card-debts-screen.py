#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'ahmed-mobile' / 'DebtsScreen.js'
text = path.read_text(encoding='utf-8')

if "import CreditCardDebtsScreen from './CreditCardDebtsScreen';" not in text:
    anchor = "import { ahmedUserHeaders } from './ahmedCurrentUser';\n"
    if anchor not in text:
        raise SystemExit('Credit card import anchor not found')
    text = text.replace(anchor, anchor + "import CreditCardDebtsScreen from './CreditCardDebtsScreen';\n", 1)

if "const [showCreditCards, setShowCreditCards]" not in text:
    anchor = "  const [savingPayment, setSavingPayment] = useState(false);\n"
    if anchor not in text:
        raise SystemExit('Credit card state anchor not found')
    text = text.replace(anchor, anchor + "  const [showCreditCards, setShowCreditCards] = useState(false);\n", 1)

old_load = '''  const load = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/debts`, {
        headers: ahmedUserHeaders({ Accept: 'application/json' }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'تعذر تحميل الديون');
      setDebts(Array.isArray(json.data) ? json.data : []);
      setSummary(json.summary || {});
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل الديون');
    } finally {
      if (showRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  };
'''

new_load = '''  const load = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setMessage('');

    try {
      const headers = ahmedUserHeaders({ Accept: 'application/json' });
      const [debtResponse, cardsResponse] = await Promise.all([
        fetch(`${API_URL}/debts`, { headers }),
        fetch(`${API_URL}/credit-card-debts`, { headers }),
      ]);
      const [debtJson, cardsJson] = await Promise.all([
        debtResponse.json(),
        cardsResponse.json(),
      ]);
      if (!debtResponse.ok) throw new Error(debtJson.message || 'تعذر تحميل الديون');
      if (!cardsResponse.ok) throw new Error(cardsJson.message || 'تعذر تحميل ديون بطائق الائتمان');

      const loanSummary = debtJson.summary || {};
      const cardSummary = cardsJson.summary || {};
      const creditCardsTotal = n(cardSummary.total_debt);
      const totalOriginal = n(loanSummary.total_original) + creditCardsTotal;
      const totalPaid = n(loanSummary.total_paid);
      const totalRemaining = n(loanSummary.total_remaining) + creditCardsTotal;

      setDebts(Array.isArray(debtJson.data) ? debtJson.data : []);
      setSummary({
        ...loanSummary,
        total_original: totalOriginal,
        total_paid: totalPaid,
        total_remaining: totalRemaining,
        progress_percent: totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0,
        credit_cards_total: creditCardsTotal,
        credit_cards_count: n(cardSummary.cards_count),
      });
    } catch (error) {
      setMessage(error.message || 'تعذر تحميل الديون');
    } finally {
      if (showRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  };
'''

if old_load in text:
    text = text.replace(old_load, new_load, 1)
elif "fetch(`${API_URL}/credit-card-debts`" not in text:
    raise SystemExit('Debt load block not found')

if "if (showCreditCards)" not in text:
    anchor = "  if (selectedDebt) {\n"
    branch = '''  if (showCreditCards) {
    return (
      <CreditCardDebtsScreen
        onBack={() => {
          setShowCreditCards(false);
          load();
        }}
        onChanged={() => load()}
      />
    );
  }

'''
    if anchor not in text:
        raise SystemExit('Credit card navigation anchor not found')
    text = text.replace(anchor, branch + anchor, 1)

entry = '''        <CreditCardsEntry
          total={summary.credit_cards_total}
          count={summary.credit_cards_count}
          onPress={() => setShowCreditCards(true)}
        />
'''
if entry not in text:
    anchor = '''        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroBadge}><UiIcon name="payments" size={18} color="#ddd6fe" /><Text style={styles.heroBadgeText}>حساباتي</Text></View>
          <Text style={styles.heroTitle}>إدارة الديون والأقساط</Text>
          <Text style={styles.heroText}>تم تحويل خط الأقساط من الشيت إلى جدول مؤتمت، وكل سداد يخصم مباشرة من المتبقي.</Text>
        </View>

'''
    if anchor not in text:
        raise SystemExit('Credit card entry anchor not found')
    text = text.replace(anchor, anchor + entry, 1)

if "function CreditCardsEntry(" not in text:
    anchor = "function KpiCard({ label, value, icon, featured, danger }) {\n"
    component = '''function CreditCardsEntry({ total, count, onPress }) {
  return (
    <TouchableOpacity style={styles.creditCardsEntry} onPress={onPress} activeOpacity={0.84}>
      <View style={styles.creditCardsArrow}>
        <UiIcon name="back" size={20} color={ICON_COLOR_DARK} />
      </View>
      <View style={styles.creditCardsTextBlock}>
        <Text style={styles.creditCardsTitle}>ديون بطائق الائتمان</Text>
        <Text style={styles.creditCardsSubtitle}>{n(count)} بطاقة • الحد كاملًا محتسب كدين</Text>
        <Text style={styles.creditCardsAmount}>{money(total)}</Text>
      </View>
      <View style={styles.creditCardsIcon}>
        <UiIcon name="payments" size={26} color={ICON_COLOR} />
      </View>
    </TouchableOpacity>
  );
}

'''
    if anchor not in text:
        raise SystemExit('Credit card component anchor not found')
    text = text.replace(anchor, component + anchor, 1)

if "creditCardsEntry:" not in text:
    anchor = "  kpiGrid: { marginTop: 14, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },\n"
    styles = '''  creditCardsEntry: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#ffffff', borderRadius: 23, borderWidth: 1, borderColor: '#ddd6fe', padding: 14 },
  creditCardsArrow: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  creditCardsTextBlock: { flex: 1, alignItems: 'flex-end' },
  creditCardsTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  creditCardsSubtitle: { marginTop: 3, color: '#64748b', fontSize: 11, fontWeight: '800', textAlign: 'right' },
  creditCardsAmount: { marginTop: 7, color: '#5b21b6', fontSize: 19, fontWeight: '900', textAlign: 'right' },
  creditCardsIcon: { width: 51, height: 51, borderRadius: 18, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', alignItems: 'center', justifyContent: 'center' },
'''
    if anchor not in text:
        raise SystemExit('Credit card styles anchor not found')
    text = text.replace(anchor, styles + anchor, 1)

path.write_text(text, encoding='utf-8')
print('Credit card debts screen patch applied')
