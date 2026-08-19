'use strict';

module.exports = function debtLastPaymentStatPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const jsxNameIs = (node, name) => t.isJSXIdentifier(node, { name });

  return {
    name: 'ahmed-debt-last-payment-stat',
    visitor: {
      Program: {
        exit(path, state) {
          if (!isTargetFile(state)) return;

          path.traverse({
            JSXElement(jsxPath) {
              const opening = jsxPath.node.openingElement;
              if (!jsxNameIs(opening.name, 'MiniStat')) return;

              const labelAttr = opening.attributes.find((attribute) => (
                t.isJSXAttribute(attribute)
                && jsxNameIs(attribute.name, 'label')
                && t.isStringLiteral(attribute.value, { value: 'الدفعة الأولى' })
              ));

              if (!labelAttr) return;

              labelAttr.value = t.stringLiteral('الدفعة الأخيرة');

              const valueAttr = opening.attributes.find((attribute) => (
                t.isJSXAttribute(attribute)
                && jsxNameIs(attribute.name, 'value')
              ));

              if (!valueAttr) return;

              const installments = t.memberExpression(t.identifier('debt'), t.identifier('installments'));
              const isArray = t.callExpression(
                t.memberExpression(t.identifier('Array'), t.identifier('isArray')),
                [t.cloneNode(installments, true)],
              );
              const length = t.memberExpression(t.cloneNode(installments, true), t.identifier('length'));
              const hasInstallments = t.logicalExpression(
                '&&',
                isArray,
                t.binaryExpression('>', t.cloneNode(length, true), t.numericLiteral(0)),
              );
              const lastIndex = t.binaryExpression('-', t.cloneNode(length, true), t.numericLiteral(1));
              const lastInstallment = t.memberExpression(t.cloneNode(installments, true), lastIndex, true);
              const lastAmount = t.memberExpression(lastInstallment, t.identifier('scheduled_amount'));

              valueAttr.value = t.jsxExpressionContainer(
                t.conditionalExpression(
                  hasInstallments,
                  t.callExpression(t.identifier('money'), [lastAmount]),
                  t.stringLiteral('-'),
                ),
              );
            },
          });
        },
      },
    },
  };
};
