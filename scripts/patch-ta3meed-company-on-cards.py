#!/usr/bin/env python3
from pathlib import Path

path = Path('ahmed-mobile/Ta3meedCompactFiltersScreen.js')
text = path.read_text(encoding='utf-8')

anchor = "  const realInvestmentDuration = formatRealInvestmentDuration(realInvestmentDays);\n"
company_line = "  const companyName = String(meta.company_name || item.company_name || '').trim();\n"
if company_line not in text:
    if anchor not in text:
        raise RuntimeError('Ta3meed card anchor not found')
    text = text.replace(anchor, anchor + company_line, 1)

card_anchor = "</View>{ta3meedCardInvestorBadges}<View style={styles.rateBadgesRow}>"
company_view = "</View>{companyName ? <View style={styles.companyCardLine}><Text style={styles.companyCardLabel}>الشركة</Text><Text style={styles.companyCardValue} numberOfLines={1}>{companyName}</Text></View> : null}{ta3meedCardInvestorBadges}<View style={styles.rateBadgesRow}>"
if 'styles.companyCardLine' not in text:
    if card_anchor not in text:
        raise RuntimeError('Ta3meed card display anchor not found')
    text = text.replace(card_anchor, company_view, 1)

style_anchor = "  investorBadgesBox: {"
style_block = """  companyCardLine: {
    marginTop: 8,
    marginBottom: 6,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  companyCardLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  companyCardValue: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'left',
    marginRight: 10,
  },

"""
if 'companyCardLine:' not in text:
    if style_anchor not in text:
        raise RuntimeError('style anchor not found')
    text = text.replace(style_anchor, style_block + style_anchor, 1)

for marker in ['companyName', 'companyCardLine', 'companyCardValue']:
    if marker not in text:
        raise RuntimeError(f'missing marker: {marker}')

path.write_text(text, encoding='utf-8')
print('Ta3meed company name added to cards')
