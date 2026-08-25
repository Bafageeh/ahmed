#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
APP_SHELL = ROOT / 'ahmed-mobile' / 'AppShell.js'


def patch_app_shell():
    text = APP_SHELL.read_text(encoding='utf-8')
    original = text

    desired_route = (
        "      if (investmentScreen === 'ta3meed') return <Ta3meedScreen "
        "onBack={() => setInvestmentScreen('list')} "
        "onOpenInvestments={() => setInvestmentScreen('list')} "
        "onOpenInvestorAccounts={() => setInvestmentScreen('ta3meedAccounts')} "
        "onOpenImageImport={() => setInvestmentScreen('ta3meedImageImport')} />;"
    )

    route_pattern = re.compile(
        r"(?m)^\s*if \(investmentScreen === 'ta3meed'\) return <Ta3meedScreen[^\n]*?/>;\s*$"
    )

    if 'onOpenInvestorAccounts' not in text or 'onOpenImageImport' not in text:
        text, count = route_pattern.subn(desired_route, text, count=1)
        if count != 1:
            raise RuntimeError('Ta3meed route was not found in AppShell.js')

    # These shortcuts now live inside the Ta3meed floating quick menu.
    text = re.sub(
        r'<MenuRow title="استيراد صورة تعميد" text="قراءة صورة الفرصة" icon="ta3meed" onPress=\{\(\) => openInvestment\(\'ta3meedImageImport\'\)\} />',
        '',
        text,
        count=1,
    )
    text = re.sub(
        r'<MenuRow title="حسابات المستثمرين" text="حركات وأرصدة المستثمرين" icon="users" onPress=\{\(\) => openInvestment\(\'ta3meedAccounts\'\)\} />',
        '',
        text,
        count=1,
    )

    if 'onOpenInvestorAccounts' not in text or 'onOpenImageImport' not in text:
        raise RuntimeError('Ta3meed navigation callbacks are still missing after repair')
    if '<MenuRow title="استيراد صورة تعميد"' in text:
        raise RuntimeError('Ta3meed image-import row still exists in More screen')
    if '<MenuRow title="حسابات المستثمرين"' in text:
        raise RuntimeError('Ta3meed investor-accounts row still exists in More screen')

    if text != original:
        APP_SHELL.write_text(text, encoding='utf-8')
        print('Ta3meed navigation callbacks repaired in AppShell.js')
    else:
        print('Ta3meed navigation callbacks already correct')


if __name__ == '__main__':
    patch_app_shell()
