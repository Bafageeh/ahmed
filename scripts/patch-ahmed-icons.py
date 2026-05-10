from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

replacements = {
    "ahmed-mobile/Ta3meedScreen.js": [
        ("<Text style={styles.smallIconText}>⌕</Text>", "<UiIcon name=\"search\" size={21} color=\"#0f172a\" />"),
        ("<Text style={styles.smallIconText}>☰</Text>", "<UiIcon name=\"filter\" size={21} color=\"#0f172a\" />"),
        ("<Text style={styles.primaryTopIconText}>↻</Text>", "<UiIcon name=\"refresh\" size={21} color=\"#ffffff\" />"),
        ("<Text style={styles.searchIcon}>⌕</Text>", "<UiIcon name=\"search\" size={19} color=\"#0f766e\" />"),
        ("<Text style={styles.cardBadge}>✎</Text>", "<UiIcon name=\"edit\" size={17} color=\"#0f766e\" />"),
        ("<IconAction icon={expanded ? '⌃' : '👁'} label=\"تفاصيل\" onPress={onToggle} />", "<IconAction iconName={expanded ? 'close' : 'view'} label=\"تفاصيل\" onPress={onToggle} />"),
        ("<IconAction icon=\"✎\" label=\"تعديل\" onPress={onEdit} tone=\"edit\" />", "<IconAction iconName=\"edit\" label=\"تعديل\" onPress={onEdit} tone=\"edit\" />"),
        ("<IconAction icon={receiving ? '…' : '✓'} label=\"استلام\" onPress={onReceive} tone=\"receive\" disabled={receiving} />", "<IconAction iconName=\"receive\" label={receiving ? '...' : 'استلام'} onPress={onReceive} tone=\"receive\" disabled={receiving} />"),
        ("function IconAction({ icon, label, onPress, tone, disabled }) {\n  return (\n    <TouchableOpacity style={[styles.iconAction, tone === 'edit' && styles.editAction, tone === 'receive' && styles.receiveAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>\n      <Text style={[styles.iconActionText, tone === 'receive' && styles.receiveActionText]}>{icon}</Text>\n      <Text style={styles.iconActionLabel}>{label}</Text>\n    </TouchableOpacity>\n  );\n}", "function IconAction({ iconName, label, onPress, tone, disabled }) {\n  const iconColor = tone === 'receive' ? '#ffffff' : '#0f766e';\n  return (\n    <TouchableOpacity style={[styles.iconAction, tone === 'edit' && styles.editAction, tone === 'receive' && styles.receiveAction, disabled && styles.disabledAction]} onPress={onPress} disabled={disabled} activeOpacity={0.82}>\n      <UiIcon name={iconName} size={17} color={iconColor} />\n      <Text style={styles.iconActionLabel}>{label}</Text>\n    </TouchableOpacity>\n  );\n}"),
    ],
    "ahmed-mobile/MoneyMoonScreen.js": [
        ("<Text style={styles.primaryTopIconText}>↻</Text>", "<UiIcon name=\"refresh\" size={21} color=\"#ffffff\" />"),
    ],
}

for relative, pairs in replacements.items():
    path = ROOT / relative
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in pairs:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"patched {relative}")
    else:
        print(f"no changes {relative}")
