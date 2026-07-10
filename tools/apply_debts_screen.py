from pathlib import Path

path = Path('ahmed-mobile/AppShell.js')
text = path.read_text(encoding='utf-8')

changes = []

old = "import PersonalExpensesScreen from './PersonalExpensesScreen';"
new = "import PersonalExpensesScreen from './PersonalExpensesScreen';\nimport DebtsScreen from './DebtsScreen';"
if "import DebtsScreen from './DebtsScreen';" not in text:
    if old not in text:
        raise RuntimeError('PersonalExpensesScreen import not found')
    text = text.replace(old, new, 1)
    changes.append('import')

old = "const fullScreenTabs = ['usersManager', 'secureVault', 'futureMonthlyIncome', 'actualMonthlyIncome', 'personalExpenses', 'financeImports', 'stats'];"
new = "const fullScreenTabs = ['usersManager', 'secureVault', 'futureMonthlyIncome', 'actualMonthlyIncome', 'personalExpenses', 'debts', 'financeImports', 'stats'];"
if "'debts'" not in text.split('const fullScreenTabs =', 1)[1].split(';', 1)[0]:
    if old not in text:
        raise RuntimeError('fullScreenTabs line not found')
    text = text.replace(old, new, 1)
    changes.append('fullScreenTabs')

old = "    if (activeTab === 'personalExpenses') return <PersonalExpensesScreen onBack={() => openTab('accounts')} />;"
new = old + "\n    if (activeTab === 'debts') return <DebtsScreen onBack={() => openTab('accounts')} />;"
if "activeTab === 'debts'" not in text:
    if old not in text:
        raise RuntimeError('personalExpenses route not found')
    text = text.replace(old, new, 1)
    changes.append('route')

old = "      <Quick title=\"مصروفاتي\" text=\"إدخال ومتابعة المصروفات الشهرية والسنوية\" icon=\"reports\" onPress={() => goTo('personalExpenses')} />\n      <Quick title=\"ثروتي\" text=\"العودة إلى ملخص الثروة\" icon=\"wealth\" onPress={() => goTo('wealth')} />"
new = "      <Quick title=\"مصروفاتي\" text=\"إدخال ومتابعة المصروفات الشهرية والسنوية\" icon=\"reports\" onPress={() => goTo('personalExpenses')} />\n      <Quick title=\"ديوني\" text=\"متابعة الأقساط والرصيد المتبقي\" icon=\"payments\" onPress={() => goTo('debts')} />\n      <Quick title=\"ثروتي\" text=\"العودة إلى ملخص الثروة\" icon=\"wealth\" onPress={() => goTo('wealth')} />"
if "title=\"ديوني\"" not in text:
    if old not in text:
        raise RuntimeError('Accounts cards block not found')
    text = text.replace(old, new, 1)
    changes.append('account card')

required = [
    "import DebtsScreen from './DebtsScreen';",
    "activeTab === 'debts'",
    "title=\"ديوني\"",
    "'debts'",
]
for marker in required:
    if marker not in text:
        raise RuntimeError(f'Missing required marker: {marker}')

path.write_text(text, encoding='utf-8')
print('Applied debts screen patch:', ', '.join(changes) if changes else 'already applied')
