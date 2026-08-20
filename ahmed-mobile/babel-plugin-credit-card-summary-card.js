'use strict';

module.exports = function creditCardSummaryCardPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const hasObjectProperty = (pattern, name) => pattern.properties.some((property) => (
    t.isObjectProperty(property)
    && t.isIdentifier(property.key, { name })
  ));

  const isDebtsMap = (expression) => {
    if (!t.isCallExpression(expression)) return false;
    const callee = expression.callee;
    return t.isMemberExpression(callee)
      && t.isIdentifier(callee.object, { name: 'debts' })
      && t.isIdentifier(callee.property, { name: 'map' });
  };

  const summaryCardElement = () => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('CreditCardsDebtSummaryCard'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('summary'),
          t.jsxExpressionContainer(t.identifier('creditCardSummary')),
        ),
        t.jsxAttribute(
          t.jsxIdentifier('onPress'),
          t.jsxExpressionContainer(t.identifier('onOpenCreditCards')),
        ),
      ],
      true,
    ),
    null,
    [],
    true,
  );

  return {
    name: 'ahmed-credit-card-summary-card',
    visitor: {
      Program(path, state) {
        if (!isTargetFile(state)) return;

        const hasImport = path.node.body.some((node) => (
          t.isImportDeclaration(node)
          && node.source.value === './CreditCardsDebtSummaryCard'
        ));

        if (!hasImport) {
          const importNode = t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier('CreditCardsDebtSummaryCard'))],
            t.stringLiteral('./CreditCardsDebtSummaryCard'),
          );
          path.unshiftContainer('body', importNode);
        }
      },

      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id || path.node.id.name !== 'DebtsScreen') return;

        const firstParam = path.node.params[0];
        if (t.isObjectPattern(firstParam)) {
          ['creditCardSummary', 'onOpenCreditCards'].forEach((name) => {
            if (!hasObjectProperty(firstParam, name)) {
              firstParam.properties.push(
                t.objectProperty(t.identifier(name), t.identifier(name), false, true),
              );
            }
          });
        }

        let inserted = false;
        path.traverse({
          JSXExpressionContainer(jsxPath) {
            if (inserted) return;
            if (!isDebtsMap(jsxPath.node.expression)) return;
            jsxPath.insertAfter(summaryCardElement());
            inserted = true;
          },
        });
      },
    },
  };
};
