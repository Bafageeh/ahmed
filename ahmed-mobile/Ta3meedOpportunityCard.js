import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FileText, Pencil, ReceiptText, Users, X } from 'lucide-react-native';

const number = (value, digits = 2) => Number(value || 0).toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});
const money = (value, digits = 2) => `${number(value, digits)} ر.س`;
const percent = (value) => `${number(value, Number(value) % 1 ? 1 : 0)}%`;
const rate = (value) => `${number(value, 2)}%`;
const displayDate = (value) => {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.split('-').reverse().join('-') : text || '—';
};
const SHEETS = {
  details: { title: 'تفاصيل الفرصة', icon: FileText },
  receipts: { title: 'سجل الدفعات', icon: ReceiptText },
  investors: { title: 'المستثمرون', icon: Users },
};

function Status({ status }) {
  return <View style={[s.status, { backgroundColor: status.bg }]}>
    <Text numberOfLines={1} style={[s.statusText, { color: status.color }]}>{status.label}</Text>
  </View>;
}

function DetailRow({ label, value, children, negative, testID }) {
  return <View style={s.detailRow}>
    <Text style={s.detailLabel}>{label}</Text>
    {children || <Text testID={testID} style={[s.detailValue, negative && s.negative]}>{value}</Text>}
  </View>;
}

function Amount({ label, value, primary, negative, compact, testID }) {
  const displayed = compact ? String(value).replace(/\s*ر\.س$/, '') : value;
  return <View style={s.amountColumn}>
    <Text style={s.amountLabel}>{label}</Text>
    <Text testID={testID} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.amountValue, primary && s.principal, compact && s.narrowAmount, negative && s.negative]}>{displayed}</Text>
    {compact && displayed !== '' ? <Text style={s.currency}>ر.س</Text> : null}
  </View>;
}

function CardRate({ label, value, actual, testID }) {
  const known = value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  return <View style={s.rateItem}>
    <Text style={s.rateLabel}>{label}</Text>
    <Text testID={testID} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
      accessibilityLabel={`نسبة الربح السنوية ${label} ${known ? rate(value) : 'غير متاحة'}`}
      style={[s.rateValue, actual && s.actualRate, known && Number(value) < 0 && s.negative]}>{known ? rate(value) : '—'}</Text>
  </View>;
}

export default function Ta3meedOpportunityCard({
  item, meta, status, category, tone, summary,
  onEdit, renderReceipt, renderInvestor,
}) {
  const [sheet, setSheet] = useState(null);
  const [cardWidth, setCardWidth] = useState(362);
  const lastSheet = useRef('details');
  const pendingEdit = useRef(false);
  const editTimer = useRef(null);
  const completed = status.key === 'received';
  const overdue = summary.isOverdue && status.key !== 'cancelled';
  const code = item.reference_number || 'فرصة تعميد';
  const activeSheet = sheet || lastSheet.current;
  const sheetInfo = SHEETS[activeSheet];
  const codeId = String(item.id);
  const fundingDate = meta.withdrawal_date || item.withdrawal_date || item.investment_date || item.start_date;
  const narrow = cardWidth < 335;
  const profit = completed ? summary.actualProfit : Number(item.expected_profit_amount || 0);
  const companyName = String(meta.company_name || '').trim() || String(item.company_name || '').trim();

  useEffect(() => () => {
    clearTimeout(editTimer.current);
    pendingEdit.current = false;
  }, []);

  const finishDismiss = () => {
    if (!pendingEdit.current) return;
    pendingEdit.current = false;
    onEdit?.(item);
  };

  const edit = () => {
    pendingEdit.current = true;
    setSheet(null);
    // iOS waits for the sheet's actual dismissal before presenting the editor.
    if (Platform.OS !== 'ios') editTimer.current = setTimeout(finishDismiss, 350);
  };

  const close = () => setSheet(null);
  const action = (kind, label, Icon) => <TouchableOpacity
    key={kind}
    testID={`opportunity-${kind}-${codeId}`}
    accessibilityRole="button"
    accessibilityLabel={`${label} ${code}`}
    onPress={() => { lastSheet.current = kind; setSheet(kind); }}
    activeOpacity={0.82}
    style={[s.action, narrow && s.narrowAction, kind === 'details' && s.primaryAction]}
  >
    <Icon size={18} color={kind === 'details' ? '#0f766e' : '#312e81'} strokeWidth={2} />
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9} style={[s.actionText, kind === 'details' && s.primaryActionText]}>{label}</Text>
  </TouchableOpacity>;

  return <>
    <View testID={`opportunity-card-${codeId}`} onLayout={(event) => setCardWidth(Math.round(event.nativeEvent.layout.width))} style={[s.card, overdue && s.overdueCard]}>
      <View style={[s.headerBand, overdue && s.overdueHeaderBand]}>
        <View style={s.cardHeader}>
          <Text testID={`opportunity-code-${codeId}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.code}>{code}</Text>
          <Status status={status} />
          <View style={[s.grade, { backgroundColor: tone.color }]}><Text style={s.gradeText}>{category}</Text></View>
        </View>

        <View testID={`opportunity-card-header-details-${codeId}`} style={s.headerDetails}>
          <View style={s.headerSide}>
            {!completed && status.key !== 'cancelled' && summary.daysLabel ? <Text style={[s.due, summary.isOverdue && s.negative]}>{summary.daysLabel}</Text> : null}
          </View>
          <View testID={`opportunity-card-rates-${codeId}`} style={s.cardRates}>
            <CardRate label="المسجلة" value={summary.annualRate} testID={`opportunity-registered-rate-${codeId}`} />
            {completed ? <CardRate label="الفعلية" value={summary.realRate} actual testID={`opportunity-actual-rate-${codeId}`} /> : null}
          </View>
          <View style={[s.headerSide, s.companyBlock]}>
            {companyName ? <Text testID={`opportunity-company-${codeId}`} accessibilityLabel={`الشركة ${companyName}`} numberOfLines={2} ellipsizeMode="tail" style={s.companyName}>{companyName}</Text> : null}
          </View>
        </View>
      </View>

      <View style={s.amounts}>
        <Amount label="المبلغ" primary compact={narrow} value={money(item.principal_amount, Number(item.principal_amount) % 1 ? 2 : 0)} />
        <View style={s.divider} />
        <Amount label={completed ? 'الربح الفعلي' : 'الربح المتوقع'} compact={narrow} value={profit === null ? '' : money(profit)} negative={profit !== null && profit < 0} testID={`opportunity-profit-${codeId}`} />
        <View style={s.divider} />
        <Amount label="المتبقي" compact={narrow} value={money(summary.remaining)} />
      </View>

      <View style={s.collection}>
        <Text style={s.received} numberOfLines={1}>المستلم {money(summary.received)}</Text>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`نسبة استلام ${code}`}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(summary.progress) }}
          style={s.track}
        ><View style={[s.fill, { width: `${summary.progress}%` }]} /></View>
        <Text style={s.progress}>{percent(summary.progress)}</Text>
      </View>

      <View style={s.actions}>
        {action('details', 'التفاصيل', FileText)}
        {action('receipts', 'الدفعات', ReceiptText)}
        {action('investors', 'المستثمرون', Users)}
      </View>
    </View>

    <Modal visible={Boolean(sheet)} transparent animationType="fade" onRequestClose={close} onDismiss={finishDismiss}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity testID={`opportunity-sheet-backdrop-${codeId}`} accessibilityRole="button" accessibilityLabel="إغلاق النافذة" activeOpacity={1} onPress={close} style={StyleSheet.absoluteFillObject} />
        <View testID={`opportunity-sheet-${codeId}`} accessibilityViewIsModal style={s.sheet}>
          <View style={s.handle} />
          <View style={s.sheetHeading}>
            <TouchableOpacity testID={`opportunity-sheet-close-${codeId}`} accessibilityRole="button" accessibilityLabel="إغلاق النافذة" onPress={close} style={s.close}>
              <X size={22} color="#312e81" strokeWidth={2} />
            </TouchableOpacity>
            <Text accessibilityRole="header" style={s.sheetTitle}>{sheetInfo.title}</Text>
          </View>
          <View style={s.sheetCodeRow}>
            <Text style={s.sheetCode}>{code}</Text>
            <View style={[s.grade, { backgroundColor: tone.color }]}><Text style={s.gradeText}>{category}</Text></View>
          </View>

          <ScrollView style={s.sheetScroll} contentContainerStyle={s.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {activeSheet === 'details' ? <>
              <DetailRow label="الحالة"><Status status={status} /></DetailRow>
              <DetailRow label="تاريخ التمويل" value={displayDate(fundingDate)} testID={`opportunity-funding-date-${codeId}`} />
              <DetailRow label="تاريخ الاستحقاق" value={displayDate(item.maturity_date)} />
              <DetailRow label="المدة" value={summary.months ? `${number(summary.months, 0)} أشهر` : '—'} />
              <DetailRow label="المبلغ" value={money(item.principal_amount)} />
              <DetailRow label="الربح المتوقع" value={money(item.expected_profit_amount)} />
              <DetailRow label="الربح الفعلي" value={summary.actualProfit === null ? '' : money(summary.actualProfit)} negative={summary.actualProfit !== null && summary.actualProfit < 0} testID={`ta3meed-actual-profit-${codeId}`} />
              <DetailRow label="المستلم" value={money(summary.received)} />
              <DetailRow label="المتبقي" value={money(summary.remaining)} />
              <DetailRow label="النسبة المسجلة" value={summary.annualRate > 0 ? rate(summary.annualRate) : '—'} />
              {completed ? <DetailRow label="النسبة السنوية الفعلية" value={summary.realRate === null ? '—' : rate(summary.realRate)} /> : null}
              {meta.ta3meed_settlement_note ? <Text style={s.note}>{meta.ta3meed_settlement_note}</Text> : null}
              {companyName ? <DetailRow label="الشركة" value={companyName} /> : null}
              {(meta.tasks || item.tasks || meta.activity || item.activity || meta.description || item.description) ? <DetailRow label="المهام" value={meta.tasks || item.tasks || meta.activity || item.activity || meta.description || item.description} /> : null}
              {(meta.executor || item.executor) ? <DetailRow label="المنفذ" value={meta.executor || item.executor} /> : null}
              {(meta.notes || item.notes) ? <DetailRow label="ملاحظات" value={meta.notes || item.notes} /> : null}
            </> : null}

            {activeSheet === 'receipts' ? <>
              <View style={s.sectionSummary}>
                <Text style={s.sectionMeta}>{item.receipts?.length || 0} دفعة</Text>
                <Text style={s.sectionAmount}>المستلم {money(summary.received)}</Text>
              </View>
              {summary.sortedReceipts.length ? summary.sortedReceipts.map(renderReceipt) : <Text style={s.empty}>لا توجد دفعات مسجلة لهذه الفرصة</Text>}
            </> : null}

            {activeSheet === 'investors' ? <>
              <Text style={s.sectionMeta}>{item.allocations?.length || 0} مستثمر</Text>
              {item.allocations?.length ? item.allocations.map(renderInvestor) : <Text style={s.empty}>لا توجد مشاركات مسجلة لهذه الفرصة</Text>}
            </> : null}
          </ScrollView>

          <SafeAreaView style={s.sheetFooter}>
            {activeSheet === 'details' && onEdit ? <TouchableOpacity testID={`opportunity-edit-${codeId}`} accessibilityRole="button" onPress={edit} style={s.edit} activeOpacity={0.82}>
              <Pencil size={19} color="#0f766e" strokeWidth={2} />
              <Text style={s.editText}>تعديل التفاصيل</Text>
            </TouchableOpacity> : <TouchableOpacity accessibilityRole="button" onPress={close} style={s.closeFooter}><Text style={s.closeFooterText}>إغلاق</Text></TouchableOpacity>}
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  card: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: '#fff', borderColor: '#dbe3ea', borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 10 },
  headerBand: { backgroundColor: '#eef8f7', marginHorizontal: -12, marginTop: -12, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomWidth: 1, borderBottomColor: '#d5e9e5' },
  overdueCard: { backgroundColor: '#fff1f2', borderColor: '#f87171' },
  overdueHeaderBand: { backgroundColor: '#fee2e2', borderBottomColor: '#fecaca' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { flex: 1, color: '#0f172a', fontSize: 19, fontWeight: '900', writingDirection: 'ltr', textAlign: 'left' },
  grade: { minWidth: 35, height: 30, paddingHorizontal: 8, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  gradeText: { fontSize: 15, fontWeight: '900', color: '#fff', writingDirection: 'ltr' },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '48%', alignSelf: 'center' },
  statusText: { fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  headerDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, minHeight: 30 },
  headerSide: { flex: 1, minWidth: 0 },
  companyBlock: { alignItems: 'flex-end' },
  companyName: { color: '#475569', fontSize: 11, lineHeight: 15, fontWeight: '600', textAlign: 'right', width: '100%' },
  cardRates: { flex: 1.2, minWidth: 0, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  rateItem: { flex: 1, minWidth: 0, alignItems: 'center' },
  rateLabel: { color: '#64748b', fontSize: 9.5, lineHeight: 13, textAlign: 'center' },
  rateValue: { color: '#334155', fontSize: 13, lineHeight: 17, fontWeight: '900', writingDirection: 'ltr', textAlign: 'center', width: '100%' },
  actualRate: { color: '#0f766e' },
  due: { fontSize: 11.5, lineHeight: 16, color: '#64748b', textAlign: 'left' },
  negative: { color: '#dc2626' },
  amounts: { flexDirection: 'row-reverse', alignItems: 'stretch', marginTop: 4 },
  amountColumn: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  amountLabel: { color: '#64748b', fontSize: 11.5, fontWeight: '600', marginBottom: 4 },
  amountValue: { color: '#0f172a', fontSize: 16, fontWeight: '800', textAlign: 'center', width: '100%' },
  principal: { fontWeight: '900', fontSize: 17 },
  narrowAmount: { fontSize: 14 },
  currency: { color: '#64748b', fontSize: 10, marginTop: 2 },
  divider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 6 },
  collection: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12 },
  received: { flexShrink: 1, fontSize: 11.5, color: '#64748b', textAlign: 'right' },
  track: { flex: 1, height: 7, minWidth: 26, backgroundColor: '#e8eef4', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#0d9488' },
  progress: { color: '#0f766e', fontSize: 12.5, fontWeight: '900', writingDirection: 'ltr', minWidth: 32 },
  actions: { flexDirection: 'row-reverse', gap: 6, marginTop: 12 },
  action: { flex: 1, minHeight: 40, minWidth: 0, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 3 },
  actionText: { color: '#475569', fontSize: 11.5, fontWeight: '700', flexShrink: 1 },
  narrowAction: { flexDirection: 'column', minHeight: 52, gap: 2 },
  primaryAction: { backgroundColor: '#e5fcf7', borderColor: '#b5f3e8' },
  primaryActionText: { color: '#0f766e' },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.46)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '72%', minHeight: '56%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#fff', paddingHorizontal: 18, paddingTop: 10, overflow: 'hidden' },
  handle: { width: 42, height: 4, borderRadius: 99, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 10 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 44, height: 44, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sheetTitle: { flex: 1, color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  sheetCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  sheetCode: { color: '#0f172a', fontSize: 21, fontWeight: '900', writingDirection: 'ltr', flexShrink: 1 },
  sheetScroll: { flexShrink: 1 },
  sheetContent: { paddingBottom: 12 },
  detailRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, justifyContent: 'space-between', minHeight: 48, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf2f7' },
  detailLabel: { color: '#64748b', fontSize: 13.5, flexShrink: 0, maxWidth: '48%', textAlign: 'right' },
  detailValue: { color: '#0f172a', fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'left' },
  note: { color: '#475569', fontSize: 13, lineHeight: 22, textAlign: 'right', paddingVertical: 12 },
  sectionSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12, gap: 8 },
  sectionMeta: { color: '#64748b', fontSize: 13, textAlign: 'right', marginVertical: 8 },
  sectionAmount: { color: '#0f766e', fontSize: 15, fontWeight: '800', textAlign: 'right' },
  empty: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 36 },
  sheetFooter: { borderTopWidth: 1, borderColor: '#edf2f7', paddingTop: 12, paddingBottom: 14 },
  edit: { minHeight: 46, backgroundColor: '#ccfbf1', borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  editText: { color: '#0f766e', fontSize: 15, fontWeight: '800' },
  closeFooter: { minHeight: 42, backgroundColor: '#f8fafc', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  closeFooterText: { color: '#475569', fontSize: 14, fontWeight: '700' },
});
