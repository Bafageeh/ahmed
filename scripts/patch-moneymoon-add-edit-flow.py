from pathlib import Path
import re

path = Path('ahmed-mobile/App.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/App.js not found')

text = path.read_text(encoding='utf-8')

# Make add investment open as a separate full screen, while edit stays inline in the same card.
text = text.replace(
    "  const [showInvestmentForm, setShowInvestmentForm] = useState(false);\n  const [editingId, setEditingId] = useState(null);",
    "  const [showInvestmentForm, setShowInvestmentForm] = useState(false);\n  const [addingScreen, setAddingScreen] = useState(false);\n  const [editingId, setEditingId] = useState(null);"
)

text = text.replace(
    """  const openAddForm = () => {
    resetForm();
    setMessage('');
    setShowInvestmentForm(true);
  };""",
    """  const openAddForm = () => {
    resetForm();
    setMessage('');
    setShowInvestmentForm(false);
    setAddingScreen(true);
  };"""
)

text = text.replace(
    """  const closeForm = () => {
    resetForm();
    setShowInvestmentForm(false);
  };""",
    """  const closeForm = () => {
    resetForm();
    setShowInvestmentForm(false);
    setAddingScreen(false);
  };"""
)

text = text.replace(
    "    setShowInvestmentForm(true);\n    setMessage('تم فتح البطاقة للتعديل');",
    "    setShowInvestmentForm(false);\n    setMessage('تم فتح البطاقة للتعديل داخل البطاقة نفسها');"
)

text = text.replace(
    "      resetForm();\n      setShowInvestmentForm(false);\n      setMessage(editingId ? 'تم تعديل بطاقة موني مون' : 'تم حفظ استثمار موني مون');",
    "      resetForm();\n      setShowInvestmentForm(false);\n      setAddingScreen(false);\n      setMessage(editingId ? 'تم تعديل بطاقة موني مون' : 'تم حفظ استثمار موني مون');"
)

# Remove the previous add/edit form that dropped down at the top of the list.
text = re.sub(
    r"\n        \{showInvestmentForm \? \(\n          <InvestmentSlideForm\n.*?\n          />\n        \) : null\}\n",
    "\n",
    text,
    count=1,
    flags=re.S,
)

# Add a full-screen form for adding new MoneyMoon investments.
if 'function MoneyMoonInvestmentFormScreen' not in text:
    component = r'''
function MoneyMoonInvestmentFormScreen({
  onBack,
  amount,
  setAmount,
  category,
  setCategory,
  investmentDate,
  setInvestmentDate,
  maturityDate,
  setMaturityDate,
  notes,
  setNotes,
  formExpectedProfit,
  message,
  saving,
  onSave,
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.fixedTopBar}>
        <TouchableOpacity style={styles.topBackButton} onPress={onBack} activeOpacity={0.85}>
          <Text style={styles.topBackText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topTitleBlock}>
          <Text style={styles.topTitle}>إضافة استثمار</Text>
          <Text style={styles.topSubtitle}>موني مون</Text>
        </View>
        <View style={styles.topAddButtonGhost}>
          <Text style={styles.topAddText}>＋</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.moneyMoonContainer}>
        <InvestmentSlideForm
          editingId={null}
          amount={amount}
          setAmount={setAmount}
          category={category}
          setCategory={setCategory}
          investmentDate={investmentDate}
          setInvestmentDate={setInvestmentDate}
          maturityDate={maturityDate}
          setMaturityDate={setMaturityDate}
          notes={notes}
          setNotes={setNotes}
          formExpectedProfit={formExpectedProfit}
          message={message}
          saving={saving}
          onSave={onSave}
          onCancel={onBack}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

'''
    text = text.replace('function InvestmentSlideForm', component + 'function InvestmentSlideForm')

if 'if (addingScreen)' not in text:
    early_return = r'''
  if (addingScreen) {
    return (
      <MoneyMoonInvestmentFormScreen
        onBack={closeForm}
        amount={amount}
        setAmount={setAmount}
        category={category}
        setCategory={setCategory}
        investmentDate={investmentDate}
        setInvestmentDate={setInvestmentDate}
        maturityDate={maturityDate}
        setMaturityDate={setMaturityDate}
        notes={notes}
        setNotes={setNotes}
        formExpectedProfit={formExpectedProfit}
        message={message}
        saving={saving}
        onSave={saveInvestment}
      />
    );
  }
'''
    # Insert inside MoneyMoonScreen, immediately before its main return.
    mm_start = text.index('function MoneyMoonScreen')
    ret_pos = text.index('  return (', mm_start)
    text = text[:ret_pos] + early_return + '\n' + text[ret_pos:]

# Pass inline-edit form props to the card.
old_props = """            deleting={deletingId === item.id}
          />"""
new_props = """            deleting={deletingId === item.id}
            isEditing={editingId === item.id}
            amount={amount}
            setAmount={setAmount}
            category={category}
            setCategory={setCategory}
            investmentDate={investmentDate}
            setInvestmentDate={setInvestmentDate}
            maturityDate={maturityDate}
            setMaturityDate={setMaturityDate}
            notes={notes}
            setNotes={setNotes}
            formExpectedProfit={formExpectedProfit}
            message={message}
            saving={saving}
            onSaveEdit={saveInvestment}
            onCancelEdit={closeForm}
          />"""
if 'isEditing={editingId === item.id}' not in text:
    text = text.replace(old_props, new_props)

text = text.replace(
    "function MoneyMoonCard({ item, onEdit, onReceive, onDelete, receiving, deleting }) {",
    "function MoneyMoonCard({ item, onEdit, onReceive, onDelete, receiving, deleting, isEditing, amount, setAmount, category: editCategory, setCategory, investmentDate, setInvestmentDate, maturityDate, setMaturityDate, notes, setNotes, formExpectedProfit, message, saving, onSaveEdit, onCancelEdit }) {"
)

inline_form = r'''
      {isEditing ? (
        <InvestmentSlideForm
          editingId={item.id}
          amount={amount}
          setAmount={setAmount}
          category={editCategory}
          setCategory={setCategory}
          investmentDate={investmentDate}
          setInvestmentDate={setInvestmentDate}
          maturityDate={maturityDate}
          setMaturityDate={setMaturityDate}
          notes={notes}
          setNotes={setNotes}
          formExpectedProfit={formExpectedProfit}
          message={message}
          saving={saving}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : null}
'''
if 'editingId={item.id}' not in text:
    text = text.replace('''
      <View style={styles.iconActionsRow}>''', inline_form + '''
      <View style={styles.iconActionsRow}>''', 1)

# Style for the disabled/placeholder plus icon on the add screen.
if 'topAddButtonGhost' not in text:
    text = text.replace(
        "  topAddButton: { width: 46, height: 42, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06b6d4' },",
        "  topAddButton: { width: 46, height: 42, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06b6d4' },\n  topAddButtonGhost: { width: 46, height: 42, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#cffafe' },"
    )

path.write_text(text, encoding='utf-8')
print('MoneyMoon add screen and inline edit flow patch applied')
