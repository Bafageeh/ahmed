import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StatsDashboardScreen from './StatsDashboardScreen';
import Ta3meedScreen from './Ta3meedNoResetFilterScreen';
import Ta3meedInvestorAccountsScreen from './Ta3meedInvestorAccountsScreen';
import Ta3meedImageImportScreen from './Ta3meedImageImportScreen';
import MoneyMoonScreen from './MoneyMoonActiveOnlyScreen';
import WealthScreen from './WealthScreen';
import AhmedUsersManagerPanel from './AhmedUsersManagerPanel';
import SecureVaultScreen from './SecureVaultScreen';
import UiIcon, { ICON_COLOR, ICON_COLOR_DARK, ICON_COLOR_SOFT } from './UiIcon';
import * as LocalAuthentication from 'expo-local-authentication';

const tabs = [
  { key: 'wealth', label: 'ثروتي', icon: 'wealth' },
  { key: 'accounts', label: 'حساباتي', icon: 'wealth' },
  { key: 'reports', label: '', icon: 'reports', center: true, accessibilityLabel: 'تقارير' },
  { key: 'investments', label: 'استثماراتي', icon: 'investments' },
  { key: 'more', label: 'مزيد', icon: 'more' },
];
const activeInvestmentKeys = ['ta3meed', 'ta3meedAccounts', 'ta3meedImageImport', 'moneymoon'];
const platforms = [
  { key: 'ta3meed', name: 'تعميد', icon: 'ta3meed', text: 'فرص تعميد والتصنيفات والمستثمرين.' },
  { key: 'moneymoon', name: 'موني مون', icon: 'moneymoon', text: 'إدارة استثمارات موني مون.' },
  { key: 'dinar', name: 'دينار', icon: 'dinar', text: 'قريبًا.' },
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
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'الدخول للخزنة الآمنة',
        cancelLabel: 'إلغاء',
        disableDeviceFallback: true,
      });
      if (!result.success) return;
    }
    setActiveTab(tab);
    setInvestmentScreen('list');
  };
  const openInvestments = () => { setActiveTab('investments'); setInvestmentScreen('list'); };
  const inFullScreen = (activeTab === 'investments' && activeInvestmentKeys.includes(investmentScreen)) || activeTab === 'usersManager' || activeTab === 'secureVault';

  const renderScreen = () => {
    if (activeTab === 'accounts') return <AccountsScreen goTo={openTab} />;
    if (activeTab === 'futureMonthlyIncome') return <FutureMonthlyIncomeScreen goTo={openTab} />;
    if (activeTab === 'actualMonthlyIncome') return <ActualMonthlyIncomeScreen goTo={openTab} />;
    if (activeTab === 'usersManager') return <UsersManagerScreen onBack={() => openTab('more')} currentUser={currentUser} />;
    if (activeTab === 'secureVault') return <SecureVaultScreen onBack={() => openTab('more')} />;
    if (activeTab === 'more') return <MoreScreen goTo={openTab} setInvestmentScreen={setInvestmentScreen} setActiveTab={setActiveTab} currentUser={currentUser} isAdmin={isAdmin} onLogout={onLogout} />;
    if (activeTab === 'investments') {
      if (investmentScreen === 'ta3meed') return <Ta3meedScreen onBack={() => setInvestmentScreen('list')} onOpenMore={() => openTab('more')} />;
      if (investmentScreen === 'ta3meedAccounts') return <Ta3meedInvestorAccountsScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'ta3meedImageImport') return <Ta3meedImageImportScreen onBack={() => setInvestmentScreen('list')} />;
      if (investmentScreen === 'moneymoon') return <MoneyMoonScreen onBack={() => setInvestmentScreen('list')} />;
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
function InvestmentsScreen({ openPlatform }) {
  return <ScreenWrap><Header badge="استثماراتي" title="#S-140 منصات الاستثمار" subtitle="منصات الاستثمار فقط." icon="investments" /><View style={styles.grid}>{platforms.map((p) => { const isActive = activeInvestmentKeys.includes(p.key); return <TouchableOpacity key={p.key} disabled={!isActive} onPress={() => openPlatform(p.key)} style={[styles.card, !isActive && styles.disabledCard]}><View style={styles.iconBox}><UiIcon name={p.icon} size={29} /></View><Text style={styles.cardTitle}>{p.name}</Text><Text style={styles.cardText}>{p.text}</Text><Text style={[styles.openText, !isActive && styles.soonText]}>{isActive ? 'فتح الشاشة' : 'قريبًا'}</Text></TouchableOpacity>; })}</View></ScreenWrap>;
}

function FutureMonthlyIncomeScreen({ goTo }) {
  const [open, setOpen] = useState(false);
  const [incomeName, setIncomeName] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [monthlyIncomes, setMonthlyIncomes] = useState([]);
  const [moneyMoonMonthlyIncome, setMoneyMoonMonthlyIncome] = useState(0);
  const [ta3meedMonthlyIncome, setTa3meedMonthlyIncome] = useState(0);
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const loadIncomes = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api'}/monthly-incomes?screen=future`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      setMonthlyIncomes(Array.isArray(json.data) ? json.data : []);
    } catch {}
  };

  const loadMoneyMoonIncome = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api'}/moneymoon/investments`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      const activeTotal = rows
        .filter((item) => item.status !== 'received' && item.status !== 'completed')
        .reduce((sum, item) => sum + Number(item.principal_amount || 0), 0);
      setMoneyMoonMonthlyIncome((activeTotal * 0.12) / 12);
    } catch {
      setMoneyMoonMonthlyIncome(0);
    }
  };

  const loadTa3meedIncome = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api'}/ta3meed/investments`, { headers: { Accept: 'application/json' } });
      const json = await response.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      const activeTotal = rows
        .filter((item) => item.status !== 'received' && item.status !== 'completed')
        .reduce((sum, item) => {
          const allocations = Array.isArray(item.allocations) ? item.allocations : [];
          const ahmedAllocation = allocations.reduce((allocationSum, allocation) => {
            const key = String(allocation.investor_code || allocation.investor_name || '').trim().toLowerCase();
            const isAhmed = key === 'ahmed' || key === 'أحمد' || key === 'احمد';
            return isAhmed ? allocationSum + Number(allocation.invested_amount || 0) : allocationSum;
          }, 0);
          return sum + ahmedAllocation;
        }, 0);
      setTa3meedMonthlyIncome((activeTotal * 0.12) / 12);
    } catch {
      setTa3meedMonthlyIncome(0);
    }
  };

  useEffect(() => { loadIncomes(); loadMoneyMoonIncome(); loadTa3meedIncome(); }, []);

  const onlyNumbers = (value) => setIncomeAmount(String(value || '').replace(/[^0-9.]/g, ''));

  const resetForm = () => {
    setIncomeName('');
    setIncomeAmount('');
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
    setMenuId(null);
  };

  const startEditIncome = (item) => {
    setEditingId(item.id);
    setIncomeName(item.name);
    setIncomeAmount(String(item.amount || ''));
    setOpen(true);
    setMenuId(null);
  };

  const deleteIncome = async (id) => {
    try {
      await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api'}/monthly-incomes/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      await loadIncomes();
    } catch {}
    setMenuId(null);
  };

  const saveIncome = () => {
    const name = String(incomeName || '').trim();
    const amount = Number(incomeAmount || 0);
    if (!name || !amount) return;

    const saveToDb = async () => {
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';
      const url = editingId ? `${baseUrl}/monthly-incomes/${editingId}` : `${baseUrl}/monthly-incomes`;
      await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ screen: 'future', name, amount }),
      });
      await loadIncomes();
      resetForm();
      setOpen(false);
    };
    saveToDb();
  };

  const total = monthlyIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(moneyMoonMonthlyIncome || 0) + Number(ta3meedMonthlyIncome || 0);

  return <View style={styles.fullScreenHost}>
    <ScreenWrap>
      <View style={styles.simpleTopBar}>
        <TouchableOpacity style={styles.simpleBackButton} onPress={() => goTo('accounts')}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.simpleTopTitle}>#S-121 دخل شهري مستقبلي</Text>
        <TouchableOpacity style={styles.topAddButton} onPress={openAdd} activeOpacity={0.86}>
          <Text style={styles.topAddText}>+</Text>
        </TouchableOpacity>
      </View>

      <Header badge="حساباتي" title="#S-121 دخل شهري مستقبلي" subtitle="شاشة لحساب الدخل الشهري المتوقع مستقبلًا." icon="reports" />

      <View style={styles.incomeTotalCard}>
        <Text style={styles.incomeTotalLabel}>إجمالي الدخل الشهري المستقبلي</Text>
        <Text style={styles.incomeTotalValue}>{total.toLocaleString('en-US')} ر.س</Text>
      </View>

      <View style={styles.incomeList}>
        <View style={[styles.incomeRow, styles.fixedIncomeRow]}>
          <View style={styles.fixedIncomeBadge}>
            <Text style={styles.fixedIncomeBadgeText}>ثابت</Text>
          </View>
          <View style={styles.incomeRowIcon}>
            <UiIcon name="moneymoon" size={22} color={ICON_COLOR_DARK} />
          </View>
          <View style={styles.incomeRowText}>
            <Text style={styles.incomeRowTitle}>موني مون</Text>
            <Text style={styles.incomeRowAmount}>{Number(moneyMoonMonthlyIncome || 0).toLocaleString('en-US')} ر.س</Text>
            <Text style={styles.fixedIncomeFormula}>المبلغ النشط في موني مون × 0.12 ÷ 12</Text>
          </View>
        </View>

        <View style={[styles.incomeRow, styles.fixedIncomeRowTa3meed]}>
          <View style={styles.fixedIncomeBadgeTa3meed}>
            <Text style={styles.fixedIncomeBadgeTextTa3meed}>ثابت</Text>
          </View>
          <View style={styles.incomeRowIcon}>
            <UiIcon name="ta3meed" size={22} color={ICON_COLOR_DARK} />
          </View>
          <View style={styles.incomeRowText}>
            <Text style={styles.incomeRowTitle}>قيمة استثمار تعميد</Text>
            <Text style={styles.incomeRowAmount}>{Number(ta3meedMonthlyIncome || 0).toLocaleString('en-US')} ر.س</Text>
            <Text style={styles.fixedIncomeFormulaTa3meed}>استثمار تعميد للمستثمر أحمد × 0.12 ÷ 12</Text>
          </View>
        </View>

        {monthlyIncomes.length === 0 ? (
          <Text style={styles.emptyIncomeText}>لا توجد حسابات دخل مضافة بعد.</Text>
        ) : monthlyIncomes.map((item) => (
          <View key={item.id} style={styles.incomeRow}>
            <View style={styles.incomeRowIcon}>
              <UiIcon name="reports" size={22} color={ICON_COLOR_DARK} />
            </View>
            <View style={styles.incomeRowText}>
              <Text style={styles.incomeRowTitle}>{item.name}</Text>
              <Text style={styles.incomeRowAmount}>{Number(item.amount || 0).toLocaleString('en-US')} ر.س</Text>
            </View>

            <View style={styles.incomeMenuHost}>
              <TouchableOpacity style={styles.incomeDotsButton} onPress={() => setMenuId(menuId === item.id ? null : item.id)} activeOpacity={0.85}>
                <Text style={styles.incomeDotsText}>⋯</Text>
              </TouchableOpacity>

              {menuId === item.id ? (
                <View style={styles.incomeDropdownMenu}>
                  <TouchableOpacity style={styles.incomeDropdownItem} onPress={() => startEditIncome(item)}>
                    <Text style={styles.incomeDropdownText}>تعديل</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.incomeDropdownItem} onPress={() => deleteIncome(item.id)}>
                    <Text style={[styles.incomeDropdownText, styles.incomeDropdownDeleteText]}>حذف</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.incomeDropdownItem, styles.incomeDropdownLast]} onPress={() => setMenuId(null)}>
                    <Text style={styles.incomeDropdownText}>إغلاق</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </ScreenWrap>

    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.incomeModalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.closeButton} onPress={() => { setOpen(false); resetForm(); }}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'تعديل دخل شهري' : 'إضافة دخل شهري'}</Text>
          </View>

          <Text style={styles.inputLabel}>اسم الدخل</Text>
          <TextInput
            value={incomeName}
            onChangeText={setIncomeName}
            placeholder="مثال: راتب، إيجار، أرباح"
            placeholderTextColor="#94a3b8"
            style={styles.modalInput}
            textAlign="right"
          />

          <Text style={styles.inputLabel}>المبلغ</Text>
          <TextInput
            value={incomeAmount}
            onChangeText={onlyNumbers}
            placeholder="0"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            style={styles.modalInput}
            textAlign="right"
          />

          <TouchableOpacity style={styles.modalSaveButton} onPress={saveIncome}>
            <Text style={styles.modalSaveText}>{editingId ? 'حفظ التعديل' : 'حفظ'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

function ActualMonthlyIncomeScreen({ goTo }) {
  return <ScreenWrap><View style={styles.simpleTopBar}><TouchableOpacity style={styles.simpleBackButton} onPress={() => goTo('accounts')}><UiIcon name="back" size={24} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.simpleTopTitle}>دخل شهري حقيقي</Text><View style={styles.simpleBackButton} /></View><Header badge="حساباتي" title="#S-122 دخل شهري حقيقي" subtitle="شاشة جديدة لحساب الدخل الشهري الفعلي." icon="wealth" /></ScreenWrap>;
}

function UsersManagerScreen({ onBack, currentUser }) {
  return <ScreenWrap><View style={styles.simpleTopBar}><TouchableOpacity style={styles.simpleBackButton} onPress={onBack}><UiIcon name="back" size={24} color={ICON_COLOR_DARK} /></TouchableOpacity><Text style={styles.simpleTopTitle}>إدارة المستخدمين</Text><View style={styles.simpleBackButton} /></View><Header badge="Ahmed" title="#S-151 إدارة المستخدمين" subtitle="هذه الشاشة للمدير فقط، ولا تسمح بتغيير حساب الجلسة أو مشاهدة بيانات مستخدم آخر." icon="users" /><AhmedUsersManagerPanel currentUser={currentUser} /></ScreenWrap>;
}
function MoreScreen({ goTo, setInvestmentScreen, setActiveTab, currentUser, isAdmin, onLogout }) {
  const openInvestment = (screen) => { setActiveTab('investments'); setInvestmentScreen(screen); };
  return <ScreenWrap><Header badge={currentUser?.name || 'Ahmed'} title="#S-150 مزيد" subtitle="الاختصارات والإعدادات." icon="settings" /><View style={styles.currentUserCard}><Text style={styles.currentUserTitle}>الحساب الحالي</Text><Text style={styles.currentUserText}>{currentUser?.name || '-'}</Text><Text style={styles.currentUserText}>اسم الدخول: {currentUser?.username || '-'}</Text></View><View style={styles.menu}>{isAdmin ? <MenuRow title="#S-151 إدارة المستخدمين" text="إضافة وتعديل المستخدمين للمدير فقط" icon="users" onPress={() => goTo('usersManager')} /> : null}<MenuRow title="الخزنة الآمنة" text="حفظ الحسابات والبطاقات وCVV والبيانات الحساسة" icon="settings" onPress={() => goTo('secureVault')} /><MenuRow title="احصائيات" text="احصائيات عامة" icon="stats" onPress={() => goTo('stats')} /><MenuRow title="استيراد صورة تعميد" text="قراءة صورة الفرصة" icon="ta3meed" onPress={() => openInvestment('ta3meedImageImport')} /><MenuRow title="حسابات المستثمرين" text="حركات وأرصدة المستثمرين" icon="users" onPress={() => openInvestment('ta3meedAccounts')} /><MenuRow title="خروج" text="إقفال الجلسة والعودة لشاشة الدخول" icon="close" onPress={onLogout} danger last /></View></ScreenWrap>;
}
function Quick({ title, icon, onPress }) { return <TouchableOpacity onPress={onPress} style={styles.card}><View style={styles.iconBox}><UiIcon name={icon} size={24} /></View><Text style={styles.cardTitle}>{title}</Text></TouchableOpacity>; }
function MenuRow({ title, text, icon, onPress, last, danger }) { return <TouchableOpacity onPress={onPress} style={[styles.menuRow, last && styles.menuRowLast, danger && styles.menuRowDanger]}><View style={[styles.menuIcon, danger && styles.menuIconDanger]}><UiIcon name={icon} size={24} color={danger ? "#b91c1c" : ICON_COLOR_DARK} /></View><View style={styles.menuTextBlock}><Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>{title}</Text><Text style={[styles.menuText, danger && styles.menuTextDanger]}>{text}</Text></View><UiIcon name="back" size={22} color={danger ? "#b91c1c" : ICON_COLOR_SOFT} /></TouchableOpacity>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f7fb' },
  fullScreenHost: { flex: 1, backgroundColor: '#f4f7fb' },
  floatingAddButton: { position: 'absolute', left: 22, bottom: 112, width: 58, height: 58, borderRadius: 20, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  floatingAddText: { color: '#fff', fontSize: 34, fontWeight: '900', marginTop: -3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 18 },
  incomeModalCard: { backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#0f172a', fontSize: 26, fontWeight: '900' },
  modalTitle: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  inputLabel: { marginTop: 10, marginBottom: 6, color: '#334155', fontWeight: '900', textAlign: 'right' },
  modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#dbe3ea', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, color: '#0f172a', fontWeight: '900', fontSize: 15 },
  modalSaveButton: { marginTop: 16, backgroundColor: '#0f766e', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  screenLayer: { flex: 1, paddingBottom: 98 },
  noTabs: { paddingBottom: 0 },
  safe: { flex: 1, backgroundColor: '#f4f7fb' },
  page: { padding: 18, paddingBottom: 34 },
  simpleTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 },
  simpleBackButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#dbe3ea', alignItems: 'center', justifyContent: 'center' },
  topAddButton: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99f6e4' },
  topAddText: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: -3 },
  simpleTopTitle: { color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  header: { marginTop: 10, backgroundColor: '#0f172a', borderRadius: 30, padding: 24, borderWidth: 1, borderColor: '#1e293b' },
  headerBadge: { alignSelf: 'flex-start', flexDirection: 'row-reverse', gap: 7, alignItems: 'center', backgroundColor: 'rgba(148,163,184,0.18)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  headerBadgeText: { color: '#cbd5e1', fontWeight: '900' },
  headerTitle: { marginTop: 16, color: '#fff', fontSize: 34, fontWeight: '900', textAlign: 'right' },
  headerSubtitle: { marginTop: 8, color: '#cbd5e1', lineHeight: 23, textAlign: 'right', fontWeight: '700' },
  currentUserCard: { marginTop: 14, backgroundColor: '#ecfdf5', borderRadius: 22, borderWidth: 1, borderColor: '#99f6e4', padding: 14, alignItems: 'flex-end' },
  currentUserTitle: { color: '#0f766e', fontWeight: '900', fontSize: 17, textAlign: 'right' },
  currentUserText: { marginTop: 4, color: '#0f172a', fontWeight: '800', textAlign: 'right' },
  grid: { marginTop: 16, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  card: { flexBasis: '47.5%', flexGrow: 1, minHeight: 150, backgroundColor: '#fff', borderRadius: 26, padding: 16, borderWidth: 1, borderColor: '#dbe7e5', alignItems: 'flex-end' },
  disabledCard: { opacity: 0.72, backgroundColor: '#f8fafc' },
  iconBox: { width: 54, height: 54, borderRadius: 20, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  cardText: { marginTop: 6, color: '#64748b', lineHeight: 20, fontWeight: '700', textAlign: 'right' },
  openText: { marginTop: 'auto', color: ICON_COLOR_DARK, fontWeight: '900', textAlign: 'right' },
  soonText: { color: '#94a3b8' },
  incomeTotalCard: { marginTop: 16, backgroundColor: '#ecfdf5', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#99f6e4', alignItems: 'flex-end' },
  incomeTotalLabel: { color: '#0f766e', fontWeight: '900', fontSize: 14, textAlign: 'right' },
  incomeTotalValue: { marginTop: 6, color: '#0f172a', fontWeight: '900', fontSize: 28, textAlign: 'right' },
  incomeList: { marginTop: 14, gap: 10 },
  emptyIncomeText: { color: '#64748b', fontWeight: '800', textAlign: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 16, overflow: 'hidden' },
  incomeRow: { backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', gap: 12, overflow: 'visible' },
  incomeMenuHost: { position: 'relative', zIndex: 20 },
  incomeDotsButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  incomeDotsText: { color: '#0f172a', fontSize: 24, fontWeight: '900', marginTop: -8 },
  incomeDropdownMenu: { position: 'absolute', top: 42, left: 0, minWidth: 118, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', elevation: 8, shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, zIndex: 99 },
  incomeDropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'flex-end' },
  incomeDropdownLast: { borderBottomWidth: 0 },
  incomeDropdownText: { color: '#0f172a', fontWeight: '900', fontSize: 14, textAlign: 'right' },
  incomeDropdownDeleteText: { color: '#b91c1c' },
  incomeRowIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  incomeRowText: { flex: 1, alignItems: 'flex-end' },
  incomeRowTitle: { color: '#0f172a', fontWeight: '900', fontSize: 17, textAlign: 'right' },
  incomeRowAmount: { marginTop: 4, color: '#0f766e', fontWeight: '900', fontSize: 15, textAlign: 'right' },
  fixedIncomeRow: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  fixedIncomeBadge: { backgroundColor: '#ffedd5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#fdba74' },
  fixedIncomeBadgeText: { color: '#c2410c', fontWeight: '900', fontSize: 11 },
  fixedIncomeFormula: { marginTop: 4, color: '#9a3412', fontWeight: '800', fontSize: 11, textAlign: 'right' },
  fixedIncomeRowTa3meed: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  fixedIncomeBadgeTa3meed: { backgroundColor: '#e0e7ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#a5b4fc' },
  fixedIncomeBadgeTextTa3meed: { color: '#3730a3', fontWeight: '900', fontSize: 11 },
  fixedIncomeFormulaTa3meed: { marginTop: 4, color: '#3730a3', fontWeight: '800', fontSize: 11, textAlign: 'right' },
  menu: { marginTop: 16, backgroundColor: '#fff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  menuRow: { padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuRowLast: { borderBottomWidth: 0 },
  menuRowDanger: { backgroundColor: '#fff1f2' },
  menuIconDanger: { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' },
  menuTitleDanger: { color: '#b91c1c' },
  menuTextDanger: { color: '#be123c' },
  menuIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  menuTextBlock: { flex: 1, alignItems: 'flex-end' },
  menuTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  menuText: { marginTop: 4, color: '#64748b', fontWeight: '700', textAlign: 'right' },
  tabWrap: { position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' },
  tabBar: { width: '100%', minHeight: 78, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  tabButton: { flex: 1, minHeight: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tabButtonActive: { backgroundColor: '#f8fafc' },
  tabIconBubble: { width: 35, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabIconBubbleActive: { backgroundColor: ICON_COLOR },
  tabLabel: { marginTop: 4, color: '#64748b', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  tabLabelActive: { color: ICON_COLOR_DARK },
  centerTabHit: { flex: 1.05, minHeight: 74, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  centerTabButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#fff' },
  centerTabButtonActive: { backgroundColor: ICON_COLOR_DARK },
});