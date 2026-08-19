'use strict';

module.exports = function debtDetailExtraStatsPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const member = (name) => t.memberExpression(t.identifier('debt'), t.identifier(name));
  const call = (name, args) => t.callExpression(t.identifier(name), args);

  const miniStat = (label, valueExpression) => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('MiniStat'),
      [
        t.jsxAttribute(t.jsxIdentifier('label'), t.stringLiteral(label)),
        t.jsxAttribute(t.jsxIdentifier('value'), t.jsxExpressionContainer(valueExpression)),
      ],
      true,
    ),
    null,
    [],
    true,
  );

  const gridHasLabel = (grid, label) => grid.children.some((child) => {
    if (!t.isJSXElement(child)) return false;
    if (!t.isJSXIdentifier(child.openingElement.name, { name: 'MiniStat' })) return false;
    return child.openingElement.attributes.some((attribute) => (
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name: 'label' })
      && t.isStringLiteral(attribute.value, { value: label })
    ));
  });

  const isDetailStatsGrid = (element) => {
    if (!t.isJSXIdentifier(element.openingElement.name, { name: 'View' })) return false;
    return element.openingElement.attributes.some((attribute) => {
      if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name, { name: 'style' })) return false;
      if (!t.isJSXExpressionContainer(attribute.value)) return false;
      const expression = attribute.value.expression;
      return t.isMemberExpression(expression)
        && t.isIdentifier(expression.object, { name: 'styles' })
        && t.isIdentifier(expression.property, { name: 'detailStatsGrid' });
    });
  };

  return {
    name: 'ahmed-debt-detail-extra-stats',
    visitor: {
      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id || path.node.id.name !== 'DebtDetailHero') return;

        path.traverse({
          JSXElement(jsxPath) {
            const grid = jsxPath.node;
            if (!isDetailStatsGrid(grid)) return;

            const stats = [
              ['الدفعة الأولى', call('money', [member('down_payment')])],
              ['تاريخ البدء', t.conditionalExpression(
                member('contract_date'),
                call('dateLabel', [member('contract_date')]),
                t.stringLiteral('-'),
              )],
              ['مبلغ الربح', call('money', [member('profit_amount')])],
              ['هامش الربح', t.conditionalExpression(
                t.binaryExpression('!=', member('profit_margin'), t.nullLiteral()),
                call('percent', [member('profit_margin')]),
                t.stringLiteral('-'),
              )],
              ['الأقساط المتبقية', call('String', [
                t.conditionalExpression(
                  t.binaryExpression('!=', member('remaining_installments_count'), t.nullLiteral()),
                  member('remaining_installments_count'),
                  t.numericLiteral(0),
                ),
              ])],
            ];

            stats.forEach(([label, expression]) => {
              if (!gridHasLabel(grid, label)) grid.children.push(miniStat(label, expression));
            });

            jsxPath.skip();
          },
        });
      },
    },
  };
};
