from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

# Remove the back button from the crowded header if it is still there.
old_back = """        <TouchableOpacity style={styles.headerIcon} onPress={onBack} activeOpacity={0.85}>
          <UiIcon name=\"back\" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
"""
text = text.replace(old_back, "")

old_back_fixed = """        <TouchableOpacity style={[styles.headerIcon, styles.backButtonFixed]} onPress={onBack} activeOpacity={0.85}>
          <UiIcon name=\"back\" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
"""
text = text.replace(old_back_fixed, "")

# Add an independent floating back button outside the header and away from the add button.
needle = """      <StatusBar style=\"dark\" />
      <View style={styles.header}>"""
replacement = """      <StatusBar style=\"dark\" />
      <TouchableOpacity style={styles.ta3meedFloatingBack} onPress={onBack} activeOpacity={0.85}>
        <UiIcon name=\"back\" size={23} color={ICON_COLOR_DARK} />
      </TouchableOpacity>
      <View style={styles.header}>"""
if "ta3meedFloatingBack" not in text and needle in text:
    text = text.replace(needle, replacement, 1)

# Give the header enough top/right breathing room so the floating back button is visible and never under the add button.
style = """
  ta3meedFloatingBack: {
    position: 'absolute',
    right: 18,
    top: 64,
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
"""
if "ta3meedFloatingBack:" not in text:
    idx = text.rfind("});")
    if idx != -1:
        text = text[:idx] + style + text[idx:]

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed floating back button")
else:
    print("Ta3meed floating back button already patched")
