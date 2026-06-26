#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/AppShell.js')
text = path.read_text(encoding='utf-8')
changed = False

def replace_once(source: str, old: str, new: str, label: str) -> str:
    global changed
    if new in source:
        return source
    if old not in source:
        raise SystemExit(f'لم أجد موضع التعديل: {label}')
    changed = True
    return source.replace(old, new, 1)

text = replace_once(
    text,
    "import SecureVaultScreen from './SecureVaultScreen';\n",
    "import SecureVaultScreen from './SecureVaultScreen';\nimport PersonalExpensesScreen from './PersonalExpensesScreen';\n",
    'استيراد شاشة المصروفات',
)

text = replace_once(
    text,
    "const fullScreenTabs = ['usersManager', 'secureVault', 'futureMonthlyIncome', 'actualMonthlyIncome', 'financeImports', 'stats'];",
    "const fullScreenTabs = ['usersManager', 'secureVault', 'futureMonthlyIncome', 'actualMonthlyIncome', 'personalExpenses', 'financeImports', 'stats'];",
    'إضافة personalExpenses للشاشات الكاملة',
)

text = replace_once(
    text,
    "    if (activeTab === 'actualMonthlyIncome') return <ActualMonthlyIncomeScreen goTo={openTab} />;\n    if (activeTab === 'financeImports') return <FinanceImportsScreen onBack={() => openTab('accounts')} />;",
    "    if (activeTab === 'actualMonthlyIncome') return <ActualMonthlyIncomeScreen goTo={openTab} />;\n    if (activeTab === 'personalExpenses') return <PersonalExpensesScreen onBack={() => openTab('accounts')} />;\n    if (activeTab === 'financeImports') return <FinanceImportsScreen onBack={() => openTab('accounts')} />;",
    'ربط شاشة المصروفات بالتنقل',
)

text = replace_once(
    text,
    "      <Quick title=\"دخل شهري حقيقي\" text=\"الدخل الفعلي المحقق\" icon=\"wealth\" onPress={() => goTo('actualMonthlyIncome')} />\n      <Quick title=\"ثروتي\" text=\"العودة إلى ملخص الثروة\" icon=\"wealth\" onPress={() => goTo('wealth')} />",
    "      <Quick title=\"دخل شهري حقيقي\" text=\"الدخل الفعلي المحقق\" icon=\"wealth\" onPress={() => goTo('actualMonthlyIncome')} />\n      <Quick title=\"مصروفاتي\" text=\"إدخال ومتابعة المصروفات الشهرية والسنوية\" icon=\"reports\" onPress={() => goTo('personalExpenses')} />\n      <Quick title=\"ثروتي\" text=\"العودة إلى ملخص الثروة\" icon=\"wealth\" onPress={() => goTo('wealth')} />",
    'إظهار بطاقة مصروفاتي تحت حساباتي',
)

if changed:
    path.write_text(text, encoding='utf-8')
    print('تم ربط شاشة مصروفاتي داخل AppShell.js')
else:
    print('شاشة مصروفاتي مربوطة مسبقًا داخل AppShell.js')
