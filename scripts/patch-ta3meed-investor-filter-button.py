#!/usr/bin/env python3
from pathlib import Path

compact_path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
compact = compact_path.read_text(encoding='utf-8')

# Top investor filter must open the investor picker inside Ta3meed.
compact = compact.replace(
    '<CompactFilter label="المستثمر" value={investorLabel} onPress={() => onOpenMore ? onOpenMore() : onBack?.()} />',
    '<CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker(\'investor\')} />'
)

# Bottom-left floating button must remain the shortcut to More.
compact = compact.replace(
    "onPress={() => setPicker('investor')}\n        style={styles.investorFloatingButton}",
    "onPress={() => onOpenMore ? onOpenMore() : onBack?.()}\n        style={styles.investorFloatingButton}"
)

if '<CompactFilter label="المستثمر" value={investorLabel} onPress={() => setPicker(\'investor\')} />' not in compact:
    raise SystemExit('Investor compact filter was not patched correctly')
if "onPress={() => onOpenMore ? onOpenMore() : onBack?.()}\n        style={styles.investorFloatingButton}" not in compact:
    raise SystemExit('Floating More button was not restored correctly')

compact_path.write_text(compact, encoding='utf-8')

wrapper_path = Path('ahmed-mobile/Ta3meedNoResetFilterScreen.js')
wrapper = wrapper_path.read_text(encoding='utf-8')

# Remove the old interception that made both buttons no-op in some builds.
wrapper = wrapper.replace(
    "if (renderingTa3meed && typeof type === 'function' && elementProps?.label === 'المستثمر') {",
    "if (false && renderingTa3meed && typeof type === 'function' && elementProps?.label === 'المستثمر') {"
)
wrapper = wrapper.replace(
    "if (renderingTa3meed && type === TouchableOpacity && isInvestorFloatingButtonStyle(elementProps?.style)) {",
    "if (false && renderingTa3meed && type === TouchableOpacity && isInvestorFloatingButtonStyle(elementProps?.style)) {"
)

# Pass the real onOpenMore from AppShell to the compact screen so the floating More button works.
wrapper = wrapper.replace(
    "screen = <Ta3meedCompactFiltersScreen key={screenKey} {...props} onOpenMore={openInvestorPickerFromLegacyButton} />;",
    "screen = <Ta3meedCompactFiltersScreen key={screenKey} {...props} />;"
)

if "if (renderingTa3meed && typeof type === 'function' && elementProps?.label === 'المستثمر')" in wrapper:
    raise SystemExit('Wrapper still intercepts investor compact filter')
if "if (renderingTa3meed && type === TouchableOpacity && isInvestorFloatingButtonStyle(elementProps?.style))" in wrapper:
    raise SystemExit('Wrapper still intercepts floating More button')
if "onOpenMore={openInvestorPickerFromLegacyButton}" in wrapper:
    raise SystemExit('Wrapper still overrides onOpenMore')

wrapper_path.write_text(wrapper, encoding='utf-8')

print('Patched Ta3meed buttons: investor filter opens picker; floating button opens More')
