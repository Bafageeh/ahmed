from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "ahmed-mobile" / "Ta3meedCompactFiltersScreen.js"

if not PATH.exists():
    print("Ta3meedCompactFiltersScreen.js not found")
    raise SystemExit(0)

text = PATH.read_text(encoding="utf-8")
original = text

old_header = """      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} onPress={onBack} activeOpacity={0.85}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعميد</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setShowSearch((value) => !value)} activeOpacity={0.85}>
            <UiIcon name="search" size={21} color={ICON_COLOR_DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.payButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}>
            <Text style={styles.payText}>سداد</Text>
          </TouchableOpacity>
        </View>
      </View>"""

new_header = """      <View style={styles.header}>
        <TouchableOpacity style={[styles.headerIcon, styles.backButtonFixed]} onPress={onBack} activeOpacity={0.85}>
          <UiIcon name="back" size={24} color={ICON_COLOR_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعميد</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setShowSearch((value) => !value)} activeOpacity={0.85}>
            <UiIcon name="search" size={21} color={ICON_COLOR_DARK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.payButton} onPress={() => setReceiptOpen(true)} activeOpacity={0.85}>
            <Text style={styles.payText}>سداد</Text>
          </TouchableOpacity>
        </View>
      </View>"""

if old_header in text:
    text = text.replace(old_header, new_header, 1)

# Normalize header-related styles by replacing existing definitions when present.
replacements = {
    "  header: {": "  header: {",
}

# Use targeted line-level replacements for common style definitions.
# If exact definitions differ, append override styles at the end; RN uses the last duplicate key.
insert = """
  header: {
    minHeight: 58,
    paddingHorizontal: 72,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerActions: {
    position: 'absolute',
    left: 14,
    top: 9,
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonFixed: {
    position: 'absolute',
    right: 14,
    top: 9,
    zIndex: 12,
  },
"""

if "backButtonFixed" not in text:
    idx = text.rfind("});")
    if idx != -1:
        text = text[:idx] + insert + text[idx:]

if text != original:
    PATH.write_text(text, encoding="utf-8")
    print("patched Ta3meed header layout")
else:
    print("Ta3meed header layout already patched")
