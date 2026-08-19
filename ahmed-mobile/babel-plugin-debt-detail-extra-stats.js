module.exports = function debtDetailExtraStatsPlugin({ types: t, template }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const hasDetailStatsStyle = (openingElement) => {
    if (!openingElement || !t.isJSXIdentifier(openingElement.name, { name: 'View' })) return false;

    const styleAttribute = openingElement.attributes.find((attribute) => {
      if (!t.isJSXAttribute(attribute)) return false;
      if (!t.isJSXIdentifier(attribute.name, { name: 'style' })) return false;
      if (!t.isJSXExpressionContainer(attribute.value)) return false;

      const expression = attribute.value.expression;
      return t.isMemberExpression(expression)
        && t.isIdentifier(expression.object, { name: 'styles' })
        && t.isIdentifier(expression.property, { name: 'detailStatsGrid' });
    });

    return Boolean(styleAttribute);
  };

  const hasLabel = (element, label) => {
    if (!t.isJSXElement(element)) return false;
    if (!t.isJSXIdentifier(element.openingElement.name, { name: 'MiniStat' })) return false;

    return element.openingElement.attributes.some((attribute) => (
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name: 'label' })
      && t.isStringLiteral(attribute.value, { value: label })
    ));
  };

  const statNodes = [
    template.expression.ast('<MiniStat label="الدفعة الأولى" value={money(debt?.down_payment)} />'),
    template.expression.ast('<MiniStat label="تاريخ البدء" value={debt?.contract_date ? dateLabel(debt.contract_date) : "-"} />'),
    template.expression.ast('<MiniStat label="مبلغ الربح" value={money(debt?.profit_amount)} />'),
    template.expression.ast('<MiniStat label="هامش الربح" value={debt?.profit_margin == null ? "-" : percent(debt.profit_margin)} />'),
    template.expression.ast('<MiniStat label="الأقساط المتبقية" value={String(debt?.remaining_installments_count ?? 0)} />'),
  ];

  return {
    name: 'ahmed-debt-detail-extra-stats',
    visitor: {
      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id || path.node.id.name !== 'DebtDetailHero') return;

        path.traverse({
          JSXElement(jsxPath) {
            if (!hasDetailStatsStyle(jsxPath.node.openingElement)) return;

            const children = jsxPath.node.children;
            statNodes.forEach((node) => {
              const labelAttribute = node.openingElement.attributes.find((attribute) => (
                t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'label' })
              ));
              const label = labelAttribute && t.isStringLiteral(labelAttribute.value) ? labelAttribute.value.value : '';

              if (!children.some((child) => hasLabel(child, label))) {
                children.push(t.cloneNode(node, true));
              }
            });

            jsxPath.stop();
          },
        });
      },
    },
  };
};
