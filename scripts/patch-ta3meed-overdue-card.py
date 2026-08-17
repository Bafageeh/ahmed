from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
"""  const durationBadgeText = raisedMonths ? `الشهور ${raisedMonths}` : '';

  const sortedReceipts = [...receipts].sort((a, b) => String(b.receipt_date || b.created_at || '').localeCompare(String(a.receipt_date || a.created_at || '')));""",
"""  const durationBadgeText = raisedMonths ? `الشهور ${raisedMonths}` : '';
  const isOverdueUnsettled = remainingDaysValue !== null
    && remainingDaysValue < 0
    && remaining > 0.009
    && status.key !== 'received';

  const sortedReceipts = [...receipts].sort((a, b) => String(b.receipt_date || b.created_at || '').localeCompare(String(a.receipt_date || a.created_at || '')));""",
'add overdue condition'
)

replace_once(
"""  return (
    <View style={[styles.card, { borderColor: status.color }]}>""",
"""  return (
    <View style={[
      styles.card,
      isOverdueUnsettled ? styles.overdueUnsettledCard : { borderColor: status.color },
    ]}>""",
'card overdue style'
)

replace_once(
"""      <View style={styles.summaryDashboard}>""",
"""      <View style={[styles.summaryDashboard, isOverdueUnsettled && styles.overdueUnsettledSurface]}>""",
'summary overdue surface'
)

replace_once(
"""      <TouchableOpacity style={styles.detailsButton} onPress={onToggle} activeOpacity={0.85}>
        <Text style={styles.detailsButtonText}>{open ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text>""",
"""      <TouchableOpacity
        style={[styles.detailsButton, isOverdueUnsettled && styles.overdueDetailsButton]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <Text style={[styles.detailsButtonText, isOverdueUnsettled && styles.overdueDetailsButtonText]}>{open ? 'إخفاء التفاصيل' : 'تفاصيل وسجل الدفعات'}</Text>""",
'details overdue style'
)

marker = """  card: {
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    padding: 12,
    overflow: 'hidden',
  },
  opportunityHeader:"""
replacement = """  card: {
    marginTop: 12,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 2,
    padding: 12,
    overflow: 'hidden',
  },
  overdueUnsettledCard: {
    backgroundColor: '#fff1f2',
    borderColor: '#f87171',
  },
  overdueUnsettledSurface: {
    backgroundColor: '#fff7f7',
    borderColor: '#fecaca',
  },
  overdueDetailsButton: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  overdueDetailsButtonText: {
    color: '#b91c1c',
  },
  opportunityHeader:"""
replace_once(marker, replacement, 'add overdue styles')

path.write_text(text, encoding='utf-8')
print('Ta3meed overdue card styling patched successfully')
