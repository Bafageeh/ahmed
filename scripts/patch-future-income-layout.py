from pathlib import Path


path = Path('ahmed-mobile/AppShell.js')
if not path.exists():
    raise SystemExit('ahmed-mobile/AppShell.js not found')

text = path.read_text(encoding='utf-8')

# Keep the existing app bottom navigation visible on S-121 and highlight "حساباتي".
old_full_screen = "  const inFullScreen = fullScreenTabs.includes(activeTab) || (activeTab === 'investments' && activeInvestmentKeys.includes(investmentScreen));"
new_full_screen = """  const inInvestmentFullScreen = activeTab === 'investments' && activeInvestmentKeys.includes(investmentScreen);
  const inFullScreen = (fullScreenTabs.includes(activeTab) && activeTab !== 'futureMonthlyIncome') || inInvestmentFullScreen;
  const bottomActiveTab = activeTab === 'futureMonthlyIncome' ? 'accounts' : activeTab;"""

if old_full_screen in text:
    text = text.replace(old_full_screen, new_full_screen, 1)
elif "const bottomActiveTab = activeTab === 'futureMonthlyIncome' ? 'accounts' : activeTab;" not in text:
    raise SystemExit('AppShell full-screen marker not found')

old_shell_return = "return <View style={styles.root}><StatusBar style=\"dark\" /><View style={[styles.screenLayer, inFullScreen && styles.noTabs]}>{renderScreen()}</View>{!inFullScreen ? <BottomTabs activeTab={activeTab} setActiveTab={openTab} /> : null}</View>;"
new_shell_return = "return <View style={styles.root}><StatusBar style=\"dark\" /><View style={[styles.screenLayer, inFullScreen && styles.noTabs]}>{renderScreen()}</View>{!inFullScreen ? <BottomTabs activeTab={bottomActiveTab} setActiveTab={openTab} /> : null}</View>;"

if old_shell_return in text:
    text = text.replace(old_shell_return, new_shell_return, 1)
elif 'activeTab={bottomActiveTab}' not in text:
    raise SystemExit('AppShell bottom-tabs return marker not found')

# Repair the S-121 refresh header, remove the black hero card and remove the top add button.
function_start = text.find('function FutureMonthlyIncomeScreen({ goTo }) {')
function_end = text.find('\nfunction ActualMonthlyIncomeScreen', function_start)
if function_start < 0 or function_end < 0:
    raise SystemExit('FutureMonthlyIncomeScreen boundaries not found')

segment = text[function_start:function_end]
header_marker = '<Header badge="حساباتي" title="#S-121 دخل شهري مستقبلي" subtitle="شاشة لحساب الدخل الشهري المتوقع مستقبلًا." icon="reports" />'
return_marker = '  return <View style={styles.fullScreenHost}><ScreenWrap'
return_index = segment.find(return_marker)
header_index = segment.find(header_marker, return_index)

if return_index < 0:
    raise SystemExit('S-121 return marker not found')

if header_index >= 0:
    clean_prefix = "  return <View style={styles.fullScreenHost}><ScreenWrap refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reloadAll(true)} tintColor=\"#0f766e\" colors={['#0f766e']} />}><TopBar title=\"#S-121 دخل شهري مستقبلي\" onBack={() => goTo('accounts')} />"
    segment = segment[:return_index] + clean_prefix + segment[header_index + len(header_marker):]
elif "colors={['#0f766e']}" not in segment or '<TopBar title="#S-121 دخل شهري مستقبلي"' not in segment:
    raise SystemExit('S-121 header could not be normalized')

# Put the add action as a floating button at the lower-left, above the existing bottom bar.
floating_button = '<TouchableOpacity style={styles.futureIncomeFloatingAdd} activeOpacity={0.88} onPress={openAdd} accessibilityRole="button" accessibilityLabel="إضافة دخل شهري"><Text style={styles.futureIncomeFloatingAddText}>+</Text></TouchableOpacity>'
if floating_button not in segment:
    modal_index = segment.find('<Modal visible={open}')
    screen_wrap_end = segment.rfind('</ScreenWrap>', 0, modal_index)
    if modal_index < 0 or screen_wrap_end < 0:
        raise SystemExit('S-121 modal or ScreenWrap closing marker not found')
    insertion_point = screen_wrap_end + len('</ScreenWrap>')
    segment = segment[:insertion_point] + floating_button + segment[insertion_point:]

text = text[:function_start] + segment + text[function_end:]

# Floating action styles. The host sits inside the screen layer, so bottom: 18 places it above the bottom navigation.
if 'futureIncomeFloatingAdd:' not in text:
    style_marker = '  header: {'
    style_index = text.find(style_marker)
    if style_index < 0:
        raise SystemExit('Style insertion marker not found')
    floating_styles = """  futureIncomeFloatingAdd: { position: 'absolute', left: 18, bottom: 18, width: 62, height: 62, borderRadius: 31, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99f6e4', elevation: 10, shadowColor: '#0f172a', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, zIndex: 120 },
  futureIncomeFloatingAddText: { color: '#fff', fontSize: 38, lineHeight: 42, fontWeight: '900', marginTop: -2 },
"""
    text = text[:style_index] + floating_styles + text[style_index:]

# Final safeguards before writing.
future_segment = text[text.find('function FutureMonthlyIncomeScreen({ goTo }) {'):text.find('\nfunction ActualMonthlyIncomeScreen')]
required = [
    'activeTab={bottomActiveTab}',
    '<TopBar title="#S-121 دخل شهري مستقبلي"',
    'style={styles.futureIncomeFloatingAdd}',
    'futureIncomeFloatingAdd:',
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing expected markers after patch: {missing}')
if header_marker in future_segment:
    raise SystemExit('The black S-121 header card is still present')

path.write_text(text, encoding='utf-8')
print('Patched S-121: removed black card, added floating add button and restored bottom navigation.')
