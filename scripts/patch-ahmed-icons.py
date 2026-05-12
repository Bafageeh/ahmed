from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "ahmed-mobile"

# This patch intentionally avoids fragile icon fonts in the Ta3meed cards.
# Some Android APK builds rendered vector/icon-font buttons as empty white circles.
# Text glyphs below are stable in React Native APK builds and keep the approved grey/neutral action style.

def patch_file(path: Path) -> bool:
    if not path.exists():
        return False

    text = path.read_text(encoding="utf-8")
    original = text

    # Standard top bar/search symbols for the older Ta3meedScreen.js implementation.
    replacements = [
        ("<Text style={styles.smallIconText}>⌕</Text>", "<Text style={styles.smallIconText}>🔍</Text>"),
        ("<Text style={styles.smallIconText}>☰</Text>", "<Text style={styles.smallIconText}>▦</Text>"),
        ("<Text style={styles.primaryTopIconText}>↻</Text>", "<Text style={styles.primaryTopIconText}>↻</Text>"),
        ("<Text style={styles.searchIcon}>⌕</Text>", "<Text style={styles.searchIcon}>🔍</Text>"),
        ("<Text style={styles.cardBadge}>✎</Text>", "<Text style={styles.cardBadge}>✎</Text>"),
        ("<IconAction icon={expanded ? '⌃' : '👁'} label=\"تفاصيل\" onPress={onToggle} />", "<IconAction icon={expanded ? '⌃' : '👁'} label=\"تفاصيل\" onPress={onToggle} />"),
        ("<IconAction iconName={expanded ? 'close' : 'view'} label=\"تفاصيل\" onPress={onToggle} />", "<IconAction icon={expanded ? '⌃' : '👁'} label=\"تفاصيل\" onPress={onToggle} />"),
        ("<IconAction icon=\"✎\" label=\"تعديل\" onPress={onEdit} tone=\"edit\" />", "<IconAction icon=\"✎\" label=\"تعديل\" onPress={onEdit} tone=\"edit\" />"),
        ("<IconAction iconName=\"edit\" label=\"تعديل\" onPress={onEdit} tone=\"edit\" />", "<IconAction icon=\"✎\" label=\"تعديل\" onPress={onEdit} tone=\"edit\" />"),
        ("<IconAction icon={receiving ? '…' : '✓'} label=\"استلام\" onPress={onReceive} tone=\"receive\" disabled={receiving} />", "<IconAction icon={receiving ? '…' : '✓'} label=\"استلام\" onPress={onReceive} tone=\"receive\" disabled={receiving} />"),
        ("<IconAction iconName=\"receive\" label={receiving ? '...' : 'استلام'} onPress={onReceive} tone=\"receive\" disabled={receiving} />", "<IconAction icon={receiving ? '…' : '✓'} label=\"استلام\" onPress={onReceive} tone=\"receive\" disabled={receiving} />"),
    ]

    for old, new in replacements:
        text = text.replace(old, new)

    # Restore the text-based IconAction renderer if a previous build patch changed it to UiIcon.
    old_icon_action = "function IconAction({ iconName, label, onPress, tone, disabled }) {\n  const iconColor = tone === 'receive' ? '#ffffff' : '#0f766e';\n  return (\n    <TouchableOpacity style={[styles.iconAction, tone === 'edit' && styles.editAction, tone === 'receive' && styles.receiveAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>\n      <UiIcon name={iconName} size={17} color={iconColor} />\n      <Text style={styles.iconActionLabel}>{label}</Text>\n    </TouchableOpacity>\n  );\n}"
    new_icon_action = "function IconAction({ icon, label, onPress, tone, disabled }) {\n  return (\n    <TouchableOpacity style={[styles.iconAction, tone === 'edit' && styles.editAction, tone === 'receive' && styles.receiveAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>\n      <Text style={[styles.iconActionText, tone === 'receive' && styles.receiveActionText]}>{icon}</Text>\n      <Text style={styles.iconActionLabel}>{label}</Text>\n    </TouchableOpacity>\n  );\n}"
    text = text.replace(old_icon_action, new_icon_action)

    # For the newer Ta3meed screen shown in the user's screenshot, some action buttons render as empty
    # circles because the icon text is missing/transparent. These broad style fixes keep the symbol visible.
    if "تعميد" in text and ("كل المستثمرين" in text or "الاستثمارات النشطة" in text or "تعذر تحميل بيانات تعميد" in text):
        text = text.replace("color: '#ffffff'", "color: '#0f172a'")
        text = text.replace("color: '#fff'", "color: '#0f172a'")
        text = text.replace("fontSize: 0", "fontSize: 18")
        text = text.replace("opacity: 0", "opacity: 1")
        text = text.replace("<Text></Text>", "<Text>▦</Text>")
        text = text.replace("<Text style={styles.iconActionText}></Text>", "<Text style={styles.iconActionText}>▦</Text>")
        text = text.replace("<Text style={styles.actionIconText}></Text>", "<Text style={styles.actionIconText}>▦</Text>")

        # If no search placeholder exists in this implementation, add a visible search trigger text next to title.
        if "ابحث" not in text and "بحث" not in text:
            text = text.replace(
                "<Text style={styles.screenTitle}>تعميد</Text>",
                "<Text style={styles.screenTitle}>تعميد</Text>\n            <Text style={styles.screenSubtitle}>🔍 بحث وتصفية الاستثمارات</Text>",
            )

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"patched {path.relative_to(ROOT)}")
        return True
    print(f"no changes {path.relative_to(ROOT)}")
    return False

patched_any = False

# Known files first.
for relative in ["ahmed-mobile/Ta3meedScreen.js", "ahmed-mobile/MoneyMoonScreen.js"]:
    patched_any = patch_file(ROOT / relative) or patched_any

# Then scan any real app files that contain the Ta3meed screen strings.
if MOBILE.exists():
    for path in MOBILE.rglob("*.js"):
        if path.name in {"Ta3meedScreen.js", "MoneyMoonScreen.js"}:
            continue
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if "تعميد" in content and ("كل المستثمرين" in content or "استثماراتي" in content or "تعذر تحميل بيانات تعميد" in content):
            patched_any = patch_file(path) or patched_any

if not patched_any:
    print("warning: no Ahmed icon/search files were patched")
