import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StatsDashboardScreen from './StatsDashboardScreen';
import Ta3meedScreen from './Ta3meedNoResetFilterScreen';
import Ta3meedInvestorAccountsScreen from './Ta3meedInvestorAccountsScreen';
import Ta3meedImageImportScreen from './Ta3meedImageImportScreen';
import MoneyMoonScreen from './MoneyMoonActiveOnlyScreen';
import DinarInvestmentsScreen from './DinarInvestmentsScreen';
import WealthScreen from './WealthScreen';
import AhmedUsersManagerPanel from './AhmedUsersManagerPanel';
import SecureVaultScreen from './SecureVaultScreen';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK, ICON_COLOR_SOFT } from './UiIcon';
import * as LocalAuthentication from 'expo-local-authentication';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
const FINANCE_SUMMARY_URL = 'https://finance.pm.sa/api/v1/integrations/ahmed/summary';
const FINANCE_NET_PROFIT_AFTER_STUCK_PATHS = [
  'income.ahmed_monthly_net_profit_after_stuck_deduction',
  'portfolio.ahmed_monthly_net_profit_after_stuck_deduction',
  'ahmed_monthly_net_profit_after_stuck_deduction',
];

const tabs = [
  { key: 'wealth', label: 'ثروتي', icon: 'wealth' },
  { key: 'accounts', label: 'حساباتي', icon: 'wealth' },
  { key: 'reports', label: '', icon: 'reports', center: true, accessibilityLabel: 'تقارير' },
  { key: 'investments', label: 'استثماراتي', icon: 'investments' },
  { key: 'more', label: 'مزيد', icon: 'more' },
];

const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon', 'dinar'];
const fullScreenTabs = ['usersManager', 'secureVault', 'futureMonthlyIncome', 'actualMonthlyIncome', 'financeImports', 'stats'];

const platforms = [
  { key: 'ta3meed', name: 'تعميد', icon: 'ta3meed', text: 'فرص تعميد والتصنيفات والمستثمرين.' },
  { key: 'moneymoon', name: 'موني مون', icon: 'moneymoon', text: 'إدارة استثمارات موني مون.' },
  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'شركات دينار والتوزيعات والإحصائيات.' },
  { key: 'tokenize', name: 'ترميز', icon: 'tokenize', text: 'قريبًا.' },
];

export default function AppShell({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('wealth');
  const [investmentScreen, setInvestmentScreen] = useState('list');
  const isAdmin = Boolean(currentUser?.is_admin);

  const openTab = async (tab) => {
    if (tab === 'secureVault') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) return;
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'الدخول للخزنة الآمنة', cancelLabel: 'إلغاء', disableDeviceFallback: true });
      if (!result.success) return;
    }
    setActiveTab(tab);
    setInvestmentScreen('list');
  };

  const openInvestments = () => { setActiveTab('investments'); setInvestmentScreen('list'); };
  const openInvestment = (screen) => { setActiveTab('investments'); setInvestmentScreen(screen); };
  const inFullScreen = fullScreenTabs.includes(activeTab) || (activeTab === 'investments' && activeInvestmentKeys.includes(investmentScreen));

  const renderScreen = () => {
    if (activeTab === 'accounts') return <AccountsScreen goTo={openTab} />;
    if (activeTab === 'reports') return <ReportsScreen goTo={openTab} openInvestments={openInvestments} />;
    if (activeTab === 'stats') return <StatsScreen onBack={() => openTab('reports')} />;
    if (activeTab === 'futureMonthlyIncome') return <FutureMonthlyIncomeScreen goTo={openTab} />;
    if (activeTab === 'actualMonthlyIncome') return <ActualMonthlyIncomeScreen goTo={openTab} />;
    if (activeTab === 'financeImports') return <FinanceImportsScreen onBack={() => openTab('accounts')} />;
    if (activeTab === 'usersManager') return <UsersManagerScreen onBack={() => openTab('more')} currentUser={currentUser} />;
    if (activeTab === 'secureVault') return <SecureVaultScreen onBack={() => openTab('more')} />;
    if (activeTab === 'more') return <MoreScreen goTo={openTab} openInvestment={openInvestment} currentUser={currentUser} isAdmin={isAdmin} onLogout={onLogout} />;
    if (activeTab === 'investments') {
      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenMore={() => openTab('more')} />;
      if (investmentScreen === 'ta3meedAccounts') return <Ta3meedInvestorAccountsScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meedImageImport') return <Ta3meedImageImportScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'moneymoon') return <MoneyMoonScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'dinar') return <DinarInvestmentsScreen onBack={() => setInvestmentScreen('list')} />;
      return <InvestmentsScreen openPlatform={setInvestmentScreen} />;
    }
    return <WealthScreen openInvestments={openInvestments} />;
  };

  return <View style={styles.root}><StatusBar style="dark" /><View style={[styles.screenLayer, inFullScreen && styles.noTabs]}>{renderScreen()}</View>{!inFullScreen ? <BottomTabs activeTab={activeTab} setActiveTab={openTab} /> : null}</View>;
}

function BottomTabs({ activeTab, setActiveTab }) {
  return <View style={styles.tabWrap} pointerEvents="box-none"><View style={styles.tabBar}>{tabs.map((tab) => <TouchableOpacity key={tab.key} activeOpacity={0.84} onPress={() => setActiveTab(tab.key)} style={[tab.center ? styles.centerTabHit : styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}>{tab.center ? <View style={[styles.centerTabButton, activeTab === tab.key && styles.centerTabButtonActive]}><UiIcon name={tab.icon} size={30} color="#fff" /></View> : <><View style={[styles.tabIconBubble, activeTab === tab.key && styles.tabIconBubbleActive]}><UiIcon name={tab.icon} size={21} color={activeTab === tab.key ? '#fff' : ICON_COLOR} /></View><Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text></>}</TouchableOpacity>)}</View></View>;
}

function Header({ badge, title, subtitle, icon }) {
  return <View style={styles.header}><View style={styles.headerBadge}><UiIcon name={icon} size={18} color="#cbd5e1" /><Text style={styles.headerBadgeText}>{badge}</Text></View><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerSubtitle}>{subtitle}</Text></View>;
}
function ScreenWrap({ children }) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>; }
function TopBar({ title, onBack, right }) { return <View style={styles.simpleTopBar}><TouchableOpacity style={styles.simpleBackButton} onPress={onBack}><UiIcon name="back" size={24} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.simpleTopTitle}>{title}</Text>{right || <View style={styles.simpleBackButton} />}</View>; }

function AccountsScreen({ goTo }) {
  return <ScreenWrap>
    <Header badge="حساباتي" title="#S-120 حساباتي" subtitle="مركز الحسابات والدخل والقيم المستوردة من Finance." icon="wealth" />
    <TouchableOpacity style={styles.financeHeroButton} activeOpacity={0.88} onPress={() => goTo('financeImports')}>
      <View style={styles.financeHeroIcon}><UiIcon name="stats" size={28} color="#0f766e" /></View>
      <View style={styles.financeHeroTextBlock}>
        <Text style={styles.financeHeroTitle}>قيم Finance المستوردة</Text>
        <Text style={styles.financeHeroText}>اضغط هنا لعرض جميع القيم المقروءة من مشروع Finance</Text>
      </View>
      <UiIcon name="back" size={22} color="#0f766e" />
    </TouchableOpacity>
    <View style={styles.grid}>
      <Quick title="دخل شهري مستقبلي" text="إدارة مصادر الدخل المتوقعة" icon="reports" onPress={() => goTo('futureMonthlyIncome')} />
      <Quick title="دخل شهري حقيقي" text="الدخل الفعلي المحقق" icon="wealth" onPress={() => goTo('actualMonthlyIncome')} />
      <Quick title="ثروتي" text="العودة إلى ملخص الثروة" icon="wealth" onPress={() => goTo('wealth')} />
    </View>
  </ScreenWrap>;
}

function ReportsScreen({ goTo, openInvestments }) {
  return <ScreenWrap><Header badge="مركز التقارير" title="#S-130 تقارير أحمد" subtitle="اختصارات التقارير والإحصائيات." icon="reports" /><View style={styles.grid}><Quick title="احصائيات" text="إحصائيات عامة" icon="stats" onPress={() => goTo('stats')} /><Quick title="حساباتي" text="الدخل والقيم المستوردة" icon="wealth" onPress={() => goTo('accounts')} /><Quick title="استثماراتي" text="منصات الاستثمار" icon="investments" onPress={openInvestments} /><Quick title="مزيد" text="الإعدادات والاختصارات" icon="more" onPress={() => goTo('more')} /></View></ScreenWrap>;
}
function StatsScreen({ onBack }) { return <ScreenWrap><TopBar title="احصائيات" onBack={onBack} /><StatsDashboardScreen /></ScreenWrap>; }
function InvestmentsScreen({ openPlatform }) { return <ScreenWrap><Header badge="استثماراتي" title="#S-140 منصات الاستثمار" subtitle="منصات الاستثمار فقط." icon="investments" /><View style={styles.grid}>{platforms.map((p) => { const isActive = activeInvestmentKeys.includes(p.key); return <TouchableOpacity key={p.key} disabled={!isActive} onPress={() => openPlatform(p.key)} style={[styles.card, !isActive && styles.disabledCard]}><View style={styles.iconBox}><UiIcon name={p.icon} size={29} /></View><Text style={styles.cardTitle}>{p.name}</Text><Text style={styles.cardText}>{p.text}</Text><Text style={[styles.openText, !isActive && styles.soonText]}>{isActive ? 'فتح الشاشة' : 'قريبًا'}</Text></TouchableOpacity>; })}</View></ScreenWrap>; }

function FinanceImportsScreen({ onBack }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadSummary = async () => { setLoading(true); setError(''); try { const response = await fetch(FINANCE_SUMMARY_URL, { headers: { Accept: 'application/json' } }); const json = await response.json(); if (!response.ok) throw new Error(json.message || 'finance fetch failed'); setSummary(json.data || json); } catch { setError('تعذر جلب بيانات Finance.'); setSummary(null); } finally { setLoading(false); } };
  useEffect(() => { loadSummary(); }, []);
  const data = summary || {};
  const sections = buildFinanceSections(data);
  const syncedAt = data.synced_at || data.syncedAt || data.updated_at || data.generated_at || '';
  return <ScreenWrap><TopBar title="#S-123 قيم Finance" onBack={onBack} right={<TouchableOpacity style={styles.refreshButton} onPress={loadSummary}><Text style={styles.refreshText}>تحديث</Text></TouchableOpacity>} /><Header badge="Finance" title="#S-123 القيم المستوردة" subtitle="جميع القيم المقروءة مباشرة من مشروع Finance بدون إدخال يدوي." icon="stats" /><View style={styles.financeSourceCard}><Text style={styles.financeSourceTitle}>المصدر</Text><Text style={styles.financeSourceText}>Finance • admin@pm.sa</Text>{syncedAt ? <Text style={styles.financeSourceMuted}>آخر مزامنة: {formatFinanceValue('synced_at', syncedAt)}</Text> : null}</View>{loading ? <Text style={styles.emptyIncomeText}>جاري تحميل قيم Finance...</Text> : null}{!!error ? <Text style={styles.financeErrorText}>{error}</Text> : null}{!loading && !error && sections.length === 0 ? <Text style={styles.emptyIncomeText}>لا توجد قيم مستوردة من Finance حاليًا.</Text> : null}{!loading && !error ? sections.map((section) => <View key={section.key} style={styles.financeSectionCard}><Text style={styles.financeSectionTitle}>{financeSectionLabel(section.key)}</Text>{section.items.map((item) => <View key={item.path} style={styles.financeValueRow}><View style={styles.financeValueTextBlock}><Text style={styles.financeValueLabel}>{financeLabel(item.path)}</Text><Text style={styles.financeValuePath}>{item.path}</Text></View><Text style={styles.financeValueAmount}>{formatFinanceValue(item.path, item.value)}</Text></View>)}</View>) : null}</ScreenWrap>;
}

function FutureMonthlyIncomeScreen({ goTo }) {
  const [open, setOpen] = useState(false);
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [monthlyIncomes, setMonthlyIncomes] = useState([]);
  const [moneyMoonMonthlyIncome, setMoneyMoonMonthlyIncome] = useState(0);
  const [ta3meedMonthlyIncome, setTa3meedMonthlyIncome] = useState(0);
  const [dinarMonthlyIncome, setDinarMonthlyIncome] = useState(0);
  const [financeNetProfitAfterStuckDeduction, setFinanceNetProfitAfterStuckDeduction] = useState(0);
  const [comMonthlyPersonNet, setComMonthlyPersonNet] = useState(0);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const loadIncomes = async () => { try { const response = await fetch(`${API_URL}/monthly-incomes?screen=future`, { headers: { Accept: 'application/json' } }); const json = await response.json(); const rows = Array.isArray(json.data) ? json.data : []; const comRow = rows.find((item) => item.source_key === 'com_monthly_person_net' || item.id === 'fixed-com-monthly-person-net'); setComMonthlyPersonNet(Number(comRow?.amount || 0)); setMonthlyIncomes(rows.filter((item) => item.source_key !== 'com_monthly_person_net' && item.id !== 'fixed-com-monthly-person-net')); } catch {} };
  const loadMoneyMoonIncome = async () => { try { const response = await fetch(`${API_URL}/moneymoon/investments`, { headers: { Accept: 'application/json' } }); const json = await response.json(); const rows = Array.isArray(json.data) ? json.data : []; const activeTotal = rows.filter((item) => item.status !== 'received' && item.status !== 'completed').reduce((sum, item) => sum + Number(item.principal_amount || 0), 0); setMoneyMoonMonthlyIncome((activeTotal * 0.12) / 12); } catch { setMoneyMoonMonthlyIncome(0); } };
  const loadTa3meedIncome = async () => {
    const safeNumber = (value) => {
      const number = Number(String(value ?? 0).replace(/,/g, ''));
      return Number.isFinite(number) ? number : 0;
    };

    const endedStatuses = ['received', 'completed', 'closed', 'finished', 'ended', 'settled', 'done', 'مستلم', 'مستلمة', 'تم الاستلام', 'منتهي', 'منتهية'];
    const cancelledStatuses = ['cancelled', 'canceled', 'void', 'ملغي', 'ملغية', 'ملغاة'];

    const statusValues = (row) => [
      row?.opportunity_status,
      row?.allocation_status,
      row?.status,
    ].map((status) => String(status || '').trim().toLowerCase()).filter(Boolean);

    const hasStatus = (row, statuses) => statusValues(row).some((status) => statuses.includes(status));
    const isInactive = (row) => hasStatus(row, endedStatuses) || hasStatus(row, cancelledStatuses);

    const principalReceivedOf = (row) => {
      const invested = safeNumber(row?.invested_amount);
      if (row?.principal_received_amount !== undefined && row?.principal_received_amount !== null) {
        return Math.min(invested, Math.max(0, safeNumber(row.principal_received_amount)));
      }
      return Math.min(invested, Math.max(0, safeNumber(row?.received_total_amount ?? row?.received_amount)));
    };

    const remainingCapitalOf = (row) => {
      if (isInactive(row)) return 0;
      if (row?.ta3meed_remaining_amount !== undefined && row?.ta3meed_remaining_amount !== null) {
        return Math.max(0, safeNumber(row.ta3meed_remaining_amount));
      }
      return Math.max(0, safeNumber(row?.invested_amount) - principalReceivedOf(row));
    };

    const normalizeTa3meedFromS111 = (raw) => {
      const summary = raw?.summary || {};
      const opportunities = Array.isArray(raw?.opportunities) ? raw.opportunities : [];

      if (summary.ta3meed !== undefined && summary.ta3meed !== null) return safeNumber(summary.ta3meed);
      if (summary.ta3meed_remaining_amount !== undefined && summary.ta3meed_remaining_amount !== null) return safeNumber(summary.ta3meed_remaining_amount);
      if (raw?.ta3meed !== undefined && raw?.ta3meed !== null) return safeNumber(raw.ta3meed);

      return opportunities
        .filter((row) => !isInactive(row))
        .reduce((sum, row) => sum + remainingCapitalOf(row), 0);
    };

    try {
      const codes = ['ahmed', 'أحمد', 'احمد'];
      let ahmedTa3meedInvestorValue = 0;

      for (const code of codes) {
        const response = await fetch(`${API_URL}/ta3meed/investors/${encodeURIComponent(code)}/account`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) continue;

        const json = await response.json();
        const data = json.data || json;
        ahmedTa3meedInvestorValue = normalizeTa3meedFromS111(data);

        if (ahmedTa3meedInvestorValue > 0) break;
      }

      setTa3meedMonthlyIncome((ahmedTa3meedInvestorValue * 0.12) / 12);
    } catch {
      setTa3meedMonthlyIncome(0);
    }
  };
  const loadDinarIncome = async () => {
    try {
      const response = await fetch(`${API_URL}/dinar/investments`, { headers: { Accept: 'application/json' } });
      const json = await response.json();

      if (!response.ok) throw new Error(json.message || 'dinar fetch failed');

      const rows = Array.isArray(json.data) ? json.data : [];
      const summaryInvestment = Number(json?.summary?.total_investment || 0);

      const totalInvestment = summaryInvestment > 0
        ? summaryInvestment
        : rows.reduce((sum, item) => sum + Number(item.investment_amount || item.investment || 0), 0);

      setDinarMonthlyIncome((totalInvestment * 0.12) / 12);
    } catch {
      setDinarMonthlyIncome(0);
    }
  };
  const loadFinanceNetProfitAfterStuckDeduction = async () => { try { const response = await fetch(FINANCE_SUMMARY_URL, { headers: { Accept: 'application/json' } }); const json = await response.json(); if (!response.ok) throw new Error(json.message || 'finance fetch failed'); const data = json.data || json; setFinanceNetProfitAfterStuckDeduction(pickFinanceNumber(data, FINANCE_NET_PROFIT_AFTER_STUCK_PATHS)); } catch { setFinanceNetProfitAfterStuckDeduction(0); } };
  useEffect(() => { loadIncomes(); loadMoneyMoonIncome(); loadTa3meedIncome(); loadDinarIncome(); loadFinanceNetProfitAfterStuckDeduction(); }, []);
  const resetForm = () => { setIncomeName(''); setIncomeAmount(''); setEditingId(null); };
  const openAdd = () => { resetForm(); setOpen(true); setMenuId(null); };
  const startEditIncome = (item) => { setEditingId(item.id); setIncomeName(item.name); setIncomeAmount(String(item.amount || '')); setOpen(true); setMenuId(null); };
  const deleteIncome = async (id) => { try { await fetch(`${API_URL}/monthly-incomes/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } }); await loadIncomes(); } catch {} setMenuId(null); };
  const saveIncome = async () => { const name = String(incomeName || '').trim(); const amount = Number(incomeAmount || 0); if (!name || !amount) return; try { await fetch(editingId ? `${API_URL}/monthly-incomes/${editingId}` : `${API_URL}/monthly-incomes`, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ screen: 'future', name, amount }) }); await loadIncomes(); resetForm(); setOpen(false); } catch {} };
  const manualTotal = monthlyIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const total = manualTotal + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0) + Number(financeNetProfitAfterStuckDeduction || 0) + Number(comMonthlyPersonNet || 0);
  const onlyNumbers = (value) => setIncomeAmount(String(value || '').replace(/[^0-9.]/g, ''));
  return <View style={styles.fullScreenHost}><ScreenWrap><TopBar title="#S-121 دخل شهري مستقبلي" onBack={() => goTo('accounts')} right={<TouchableOpacity style={styles.topAddButton} onPress={openAdd}><Text style={styles.topAddText}>+</Text></TouchableOpacity>} /><Header badge="حساباتي" title="#S-121 دخل شهري مستقبلي" subtitle="شاشة لحساب الدخل الشهري المتوقع مستقبلًا." icon="reports" /><View style={styles.incomeTotalCard}><Text style={styles.incomeTotalLabel}>إجمالي الدخل الشهري المستقبلي</Text><Text style={styles.incomeTotalValue}>{Number(total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text></View><View style={styles.incomeList}><View style={[styles.incomeRow, styles.fixedIncomeRow]}><View style={styles.fixedIncomeBadge}><Text style={styles.fixedIncomeBadgeText}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="moneymoon" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>موني مون</Text><Text style={styles.incomeRowAmount}>{Number(moneyMoonMonthlyIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormula}>المبلغ النشط في موني مون × 0.12 ÷ 12</Text></View></View><View style={[styles.incomeRow, styles.fixedIncomeRowTa3meed]}><View style={styles.fixedIncomeBadgeTa3meed}><Text style={styles.fixedIncomeBadgeTextTa3meed}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="ta3meed" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>قيمة استثمار تعميد</Text><Text style={styles.incomeRowAmount}>{Number(ta3meedMonthlyIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormulaTa3meed}>مستثمر تعميد أحمد × 0.12 ÷ 12</Text></View></View><View style={[styles.incomeRow, styles.fixedIncomeRowDinar]}><View style={styles.fixedIncomeBadgeDinar}><Text style={styles.fixedIncomeBadgeTextDinar}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="dinar" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>استثمار دينار</Text><Text style={styles.incomeRowAmount}>{Number(dinarMonthlyIncome || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormulaDinar}>إجمالي استثمار دينار × 0.12 ÷ 12</Text></View></View><View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="stats" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>ربح أحمد الشهري الصافي</Text><Text style={styles.incomeRowAmount}>{Number(financeNetProfitAfterStuckDeduction || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>Finance: ahmed_monthly_net_profit_after_stuck_deduction</Text></View></View><View style={[styles.incomeRow, styles.fixedIncomeRowFinance]}><View style={styles.fixedIncomeBadgeFinance}><Text style={styles.fixedIncomeBadgeTextFinance}>ثابت</Text></View><View style={styles.incomeRowIcon}><UiIcon name="stats" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>صافي الشخص الشهري من COM</Text><Text style={styles.incomeRowAmount}>{Number(comMonthlyPersonNet || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text><Text style={styles.fixedIncomeFormulaFinance}>COM: com_monthly_person_net</Text></View></View>{monthlyIncomes.length === 0 ? <Text style={styles.emptyIncomeText}>لا توجد حسابات دخل مضافة بعد.</Text> : monthlyIncomes.map((item) => <View key={item.id} style={styles.incomeRow}><View style={styles.incomeRowIcon}><UiIcon name="reports" size={22} color={ICON_COLOR_DARK} /></View><View style={styles.incomeRowText}><Text style={styles.incomeRowTitle}>{item.name}</Text><Text style={styles.incomeRowAmount}>{Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س</Text></View><View style={styles.incomeMenuHost}><TouchableOpacity style={styles.incomeDotsButton} onPress={() => setMenuId(menuId === item.id ? null : item.id)}><Text style={styles.incomeDotsText}>⋯</Text></TouchableOpacity>{menuId === item.id ? <View style={styles.incomeDropdownMenu}><TouchableOpacity style={styles.incomeDropdownItem} onPress={() => startEditIncome(item)}><Text style={styles.incomeDropdownText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.incomeDropdownItem} onPress={() => deleteIncome(item.id)}><Text style={[styles.incomeDropdownText, styles.incomeDropdownDeleteText]}>حذف</Text></TouchableOpacity><TouchableOpacity style={[styles.incomeDropdownItem, styles.incomeDropdownLast]} onPress={() => setMenuId(null)}><Text style={styles.incomeDropdownText}>إغلاق</Text></TouchableOpacity></View> : null}</View></View>)}</View></ScreenWrap><Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.modalBackdrop}><View style={styles.incomeModalCard}><View style={styles.modalHeaderRow}><TouchableOpacity style={styles.closeButton} onPress={() => { setOpen(false); resetForm(); }}><Text style={styles.closeText}>×</Text></TouchableOpacity><Text style={styles.modalTitle}>{editingId ? 'تعديل دخل شهري' : 'إضافة دخل شهري'}</Text></View><Text style={styles.inputLabel}>اسم الدخل</Text><TextInput value={incomeName} onChangeText={setIncomeName} placeholder="مثال: راتب، إيجار، أرباح" placeholderTextColor="#94a3b8" style={styles.modalInput} textAlign="right" /><Text style={styles.inputLabel}>المبلغ</Text><TextInput value={incomeAmount} onChangeText={onlyNumbers} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="decimal-pad" style={styles.modalInput} textAlign="right" /><TouchableOpacity style={styles.modalSaveButton} onPress={saveIncome}><Text style={styles.modalSaveText}>{editingId ? 'حفظ التعديل' : 'حفظ'}</Text></TouchableOpacity></View></View></Modal></View>;
}

function ActualMonthlyIncomeScreen({ goTo }) { return <ScreenWrap><TopBar title="دخل شهري حقيقي" onBack={() => goTo('accounts')} /><Header badge="حساباتي" title="#S-122 دخل شهري حقيقي" subtitle="شاشة لحساب الدخل الشهري الفعلي." icon="wealth" /></ScreenWrap>; }
function UsersManagerScreen({ onBack, currentUser }) { return <ScreenWrap><TopBar title="إدارة المستخدمين" onBack={onBack} /><Header badge="Ahmed" title="#S-151 إدارة المستخدمين" subtitle="هذه الشاشة للمدير فقط." icon="users" /><AhmedUsersManagerPanel currentUser={currentUser} /></ScreenWrap>; }
function MoreScreen({ goTo, openInvestment, currentUser, isAdmin, onLogout }) { return <ScreenWrap><Header badge={currentUser?.name || 'Ahmed'} title="#S-150 مزيد" subtitle="الاختصارات والإعدادات." icon="settings" /><View style={styles.currentUserCard}><Text style={styles.currentUserTitle}>الحساب الحالي</Text><Text style={styles.currentUserText}>{currentUser?.name || '-'}</Text><Text style={styles.currentUserText}>اسم الدخول: {currentUser?.username || '-'}</Text></View><View style={styles.menu}>{isAdmin ? <MenuRow title="#S-151 إدارة المستخدمين" text="إضافة وتعديل المستخدمين للمدير فقط" icon="users" onPress={() => goTo('usersManager')} /> : null}<MenuRow title="قيم Finance المستوردة" text="جميع القيم المقروءة من مشروع Finance" icon="stats" onPress={() => goTo('financeImports')} /><MenuRow title="الخزنة الآمنة" text="حفظ الحسابات والبطاقات وبيانات الدخول" icon="settings" onPress={() => goTo('secureVault')} /><MenuRow title="احصائيات" text="احصائيات عامة" icon="stats" onPress={() => goTo('stats')} /><MenuRow title="استيراد صورة تعميد" text="قراءة صورة الفرصة" icon="ta3meed" onPress={() => openInvestment('ta3meedImageImport')} /><MenuRow title="حسابات المستثمرين" text="حركات وأرصدة المستثمرين" icon="users" onPress={() => openInvestment('ta3meedAccounts')} /><MenuRow title="خروج" text="إقفال الجلسة والعودة لشاشة الدخول" icon="close" onPress={onLogout} danger last /></View></ScreenWrap>; }
function Quick({ title, text, icon, onPress }) { return <TouchableOpacity onPress={onPress} style={styles.card}><View style={styles.iconBox}><UiIcon name={icon} size={24} /></View><Text style={styles.cardTitle}>{title}</Text>{text ? <Text style={styles.cardText}>{text}</Text> : null}<Text style={styles.openText}>فتح الشاشة</Text></TouchableOpacity>; }
function MenuRow({ title, text, icon, onPress, last, danger }) { return <TouchableOpacity onPress={onPress} style={[styles.menuRow, last && styles.menuRowLast, danger && styles.menuRowDanger]}><View style={[styles.menuIcon, danger && styles.menuIconDanger]}><UiIcon name={icon} size={24} color={danger ? '#b91c1c' : ICON_COLOR_DARK} /></View><View style={styles.menuTextBlock}><Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text><Text style={[styles.menuText, danger && styles.menuTextDanger]}>{text}</Text></View><UiIcon name="back" size={22} color={danger ? '#b91c1c' : ICON_COLOR_SOFT} /></TouchableOpacity>; }

function getNestedValue(source, path) { return String(path || '').split('.').reduce((current, key) => (current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined), source); }
function pickFinanceNumber(data, paths) { for (const path of paths) { const value = getNestedValue(data, path); if (value !== undefined && value !== null && value !== '') { const numberValue = Number(value); return Number.isFinite(numberValue) ? numberValue : 0; } } return 0; }
function buildFinanceSections(data) { const root = data && typeof data === 'object' ? data : {}; return Object.keys(root).filter((key) => !['synced_at', 'syncedAt', 'updated_at', 'generated_at'].includes(key)).map((key) => ({ key, items: flattenFinanceValues(root[key], key) })).filter((section) => section.items.length > 0); }
function flattenFinanceValues(value, prefix) { if (value === null || value === undefined) return [{ path: prefix, value }]; if (Array.isArray(value)) { if (!value.length) return [{ path: prefix, value: '[]' }]; return value.flatMap((item, index) => flattenFinanceValues(item, `${prefix}[${index + 1}]`)); } if (typeof value === 'object') { const keys = Object.keys(value); if (!keys.length) return [{ path: prefix, value: '{}' }]; return keys.flatMap((key) => flattenFinanceValues(value[key], `${prefix}.${key}`)); } return [{ path: prefix, value }]; }
function financeSectionLabel(key) { const labels = { income: 'الدخل', portfolio: 'المحفظة', counts: 'الأعداد', alerts: 'التنبيهات', account: 'الحساب', meta: 'معلومات المزامنة' }; return labels[key] || key; }
function financeLabel(path) { const labels = { 'income.monthly_installments_total': 'إجمالي الأقساط الشهرية', 'income.ahmed_monthly_profit': 'ربح أحمد الشهري', 'income.ahmed_monthly_net_profit_after_stuck_deduction': 'ربح أحمد الشهري الصافي بعد خصم المتعثر', 'portfolio.ahmed_monthly_net_profit_after_stuck_deduction': 'ربح أحمد الشهري الصافي بعد خصم المتعثر', 'ahmed_monthly_net_profit_after_stuck_deduction': 'ربح أحمد الشهري الصافي بعد خصم المتعثر', 'income.remaining_installments_total': 'إجمالي الأقساط المتبقية', 'portfolio.remaining_principal_total': 'رأس المال المتبقي', 'portfolio.ahmed_total_profit': 'إجمالي ربح أحمد', 'portfolio.active_monthly_installments': 'القسط الشهري النشط', 'counts.active_clients': 'العملاء النشطون', 'counts.overdue_clients': 'العملاء المتأخرون', 'counts.legal_clients': 'عملاء القضايا' }; return labels[path] || arabizeFinanceKey(path); }
function arabizeFinanceKey(path) { const last = String(path || '').split('.').pop().replace(/\[\d+\]/g, ''); return last.replace(/_/g, ' '); }
function formatFinanceValue(path, value) { if (value === null || value === undefined || value === '') return '-'; if (typeof value === 'boolean') return value ? 'نعم' : 'لا'; if (typeof value === 'number') { const moneyLike = /amount|total|profit|principal|installment|balance|income|payment|capital|monthly/i.test(path); return moneyLike ? `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س` : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) { const numberValue = Number(value); const moneyLike = /amount|total|profit|principal|installment|balance|income|payment|capital|monthly/i.test(path); return moneyLike ? `${numberValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س` : numberValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } return String(value); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7fb' }, fullScreenHost: { flex: 1, backgroundColor: '#f4f7fb' }, screenLayer: { flex: 1, paddingBottom: 98 }, noTabs: { paddingBottom: 0 }, safe: { flex: 1, backgroundColor: '#f4f7fb' }, page: { padding: 18, paddingBottom: 34 },
  simpleTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 }, simpleBackButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' }, simpleTopTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  refreshButton: { minWidth: 72, height: 52, borderRadius: 18, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#99f6e4' }, refreshText: { color: '#fff', fontWeight: '900', fontSize: 14 }, topAddButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99f6e4' }, topAddText: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: -3 },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b' }, headerBadge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', gap: 7, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 }, headerBadgeText: { color: '#cbd5e1', fontWeight: '900' }, headerTitle: { marginTop: 16, color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'right' }, headerSubtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  financeHeroButton: { marginTop: 16, backgroundColor: '#ecfdf5', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#99f6e4', flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }, financeHeroIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99f6e4' }, financeHeroTextBlock: { flex: 1, alignItems: 'flex-end' }, financeHeroTitle: { color: '#065f46', fontWeight: '900', fontSize: 21, textAlign: 'right' }, financeHeroText: { marginTop: 5, color: '#0f766e', fontWeight: '800', lineHeight: 20, textAlign: 'right' },
  currentUserCard: { marginTop: 14, backgroundColor: '#ecfdf5', borderRadius: 22, borderWidth: 1, borderColor: '#99f6e4', padding: 14, alignItems: 'flex-end' }, currentUserTitle: { color: '#0f766e', fontWeight: '900', fontSize: 17, textAlign: 'right' }, currentUserText: { marginTop: 4, color: '#0f172a', fontWeight: '800', textAlign: 'right' },
  grid: { marginTop: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }, card: { flexBasis: '47.5%', flexGrow: 1, minHeight: 150, backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', alignItems: 'flex-end' }, disabledCard: { opacity: 0.72, backgroundColor: '#f8fafc' }, iconBox: { width: 54, height: 54, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }, cardTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' }, cardText: { marginTop: 6, color: '#64748b', lineHeight: 20, fontWeight: '700', textAlign: 'right' }, openText: { marginTop: 'auto', color: ICON_COLOR_DARK, fontWeight: '900', textAlign: 'right' }, soonText: { color: '#94a3b8' },
  financeSourceCard: { marginTop: 14, backgroundColor: '#ecfeff', borderRadius: 22, borderWidth: 1, borderColor: '#a5f3fc', padding: 14, alignItems: 'flex-end' }, financeSourceTitle: { color: '#0e7490', fontWeight: '900', fontSize: 17, textAlign: 'right' }, financeSourceText: { marginTop: 4, color: '#0f172a', fontWeight: '900', textAlign: 'right' }, financeSourceMuted: { marginTop: 4, color: '#475569', fontWeight: '800', textAlign: 'right' }, financeErrorText: { marginTop: 14, color: '#b91c1c', fontWeight: '900', textAlign: 'center', backgroundColor: '#fff1f2', borderRadius: 18, padding: 16, overflow: 'hidden' }, financeSectionCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', padding: 14 }, financeSectionTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right', marginBottom: 10 }, financeValueRow: { backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#edf2f7', padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, financeValueTextBlock: { flex: 1, alignItems: 'flex-end' }, financeValueLabel: { color: '#0f172a', fontWeight: '900', fontSize: 15, textAlign: 'right' }, financeValuePath: { marginTop: 3, color: '#94a3b8', fontWeight: '800', fontSize: 11, textAlign: 'right' }, financeValueAmount: { color: '#0f766e', fontWeight: '900', fontSize: 15, maxWidth: '45%', textAlign: 'left' },
  incomeTotalCard: { marginTop: 16, backgroundColor: '#ecfdf5', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#99f6e4', alignItems: 'flex-end' }, incomeTotalLabel: { color: '#0f766e', fontWeight: '900', fontSize: 14, textAlign: 'right' }, incomeTotalValue: { marginTop: 6, color: '#0f172a', fontWeight: '900', fontSize: 28, textAlign: 'right' }, incomeList: { marginTop: 14, gap: 10 }, emptyIncomeText: { color: '#64748b', fontWeight: '800', textAlign: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, overflow: 'hidden' }, incomeRow: { backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', gap: 12, overflow: 'visible' }, incomeMenuHost: { position: 'relative', zIndex: 20 }, incomeDotsButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, incomeDotsText: { color: '#0f172a', fontSize: 24, fontWeight: '900', marginTop: -8 }, incomeDropdownMenu: { position: 'absolute', top: 42, left: 0, minWidth: 118, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 8, shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, zIndex: 99 }, incomeDropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'flex-end' }, incomeDropdownLast: { borderBottomWidth: 0 }, incomeDropdownText: { color: '#0f172a', fontWeight: '900', fontSize: 14, textAlign: 'right' }, incomeDropdownDeleteText: { color: '#b91c1c' }, incomeRowIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }, incomeRowText: { flex: 1, alignItems: 'flex-end' }, incomeRowTitle: { color: '#0f172a', fontWeight: '900', fontSize: 17, textAlign: 'right' }, incomeRowAmount: { marginTop: 4, color: '#0f766e', fontWeight: '900', fontSize: 15, textAlign: 'right' }, fixedIncomeRow: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }, fixedIncomeBadge: { backgroundColor: '#ffedd5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#fdba74' }, fixedIncomeBadgeText: { color: '#c2410c', fontWeight: '900', fontSize: 11 }, fixedIncomeFormula: { marginTop: 4, color: '#9a3412', fontWeight: '800', fontSize: 11, textAlign: 'right' }, fixedIncomeRowTa3meed: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' }, fixedIncomeBadgeTa3meed: { backgroundColor: '#e0e7ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#a5b4fc' }, fixedIncomeBadgeTextTa3meed: { color: '#3730a3', fontWeight: '900', fontSize: 11 }, fixedIncomeFormulaTa3meed: { marginTop: 4, color: '#3730a3', fontWeight: '800', fontSize: 11, textAlign: 'right' }, fixedIncomeRowFinance: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }, fixedIncomeBadgeFinance: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#86efac' }, fixedIncomeBadgeTextFinance: { color: '#166534', fontWeight: '900', fontSize: 11 }, fixedIncomeFormulaFinance: { marginTop: 4, color: '#166534', fontWeight: '800', fontSize: 11, textAlign: 'right' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 }, incomeModalCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }, modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, closeButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#0f172a', fontSize: 26, fontWeight: '900' }, modalTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' }, inputLabel: { marginTop: 10, marginBottom: 6, color: '#334155', fontWeight: '900', textAlign: 'right' }, modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, color: '#0f172a', fontWeight: '900', fontSize: 15 }, modalSaveButton: { marginTop: 16, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }, modalSaveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  menu: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' }, menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, menuRowLast: { borderBottomWidth: 0 }, menuRowDanger: { backgroundColor: '#fff1f2' }, menuIconDanger: { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }, menuTitleDanger: { color: '#b91c1c' }, menuTextDanger: { color: '#be123c' }, menuIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }, menuTextBlock: { flex: 1, alignItems: 'flex-end' }, menuTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' }, menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' }, tabBar: { width: '100%', minHeight: 78, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 }, tabButton: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, tabButtonActive: { backgroundColor: '#f8fafc' }, tabIconBubble: { width: 35, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, tabIconBubbleActive: { backgroundColor: ICON_COLOR }, tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' }, tabLabelActive: { color: ICON_COLOR_DARK }, centerTabHit: { flex: 1.05, minHeight: 74, alignItems: 'center', justifyContent: 'center', marginTop: -26 }, centerTabButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#fff' }, centerTabButtonActive: { backgroundColor: ICON_COLOR_DARK },

  fixedIncomeRowDinar: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  fixedIncomeBadgeDinar: {
    backgroundColor: '#ede9fe',
    borderColor: '#c4b5fd',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fixedIncomeBadgeTextDinar: {
    color: '#6d28d9',
    fontSize: 12,
    fontWeight: '900',
  },
  fixedIncomeFormulaDinar: {
    marginTop: 6,
    color: '#5b21b6',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
});