'use strict';

module.exports = function debtAutoPaymentUiPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const stylesMember = (name) => t.memberExpression(t.identifier('styles'), t.identifier(name));
  const prop = (name, value) => t.objectProperty(t.identifier(name), value);
  const num = (value) => t.numericLiteral(value);
  const str = (value) => t.stringLiteral(value);

  const isPaidStatusTest = (node) => (
    t.isBinaryExpression(node, { operator: '===' })
    && t.isMemberExpression(node.left)
    && t.isIdentifier(node.left.object, { name: 'item' })
    && t.isIdentifier(node.left.property, { name: 'status' })
    && t.isStringLiteral(node.right, { value: 'paid' })
  );

  const autoPaymentBadge = () => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('View'),
      [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(stylesMember('autoPayBadge')))],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier('View')),
    [
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('Text'),
          [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(stylesMember('autoPayText')))],
          false,
        ),
        t.jsxClosingElement(t.jsxIdentifier('Text')),
        [
          t.jsxExpressionContainer(
            t.conditionalExpression(
              t.binaryExpression(
                '===',
                t.memberExpression(t.identifier('item'), t.identifier('status')),
                t.stringLiteral('paid'),
              ),
              t.stringLiteral('تم آليًا'),
              t.stringLiteral('سداد آلي'),
            ),
          ),
        ],
        false,
      ),
    ],
    false,
  );

  const hasObjectKey = (objectExpression, name) => objectExpression.properties.some((property) => {
    if (!t.isObjectProperty(property)) return false;
    if (t.isIdentifier(property.key)) return property.key.name === name;
    if (t.isStringLiteral(property.key)) return property.key.value === name;
    return false;
  });

  return {
    name: 'ahmed-debt-auto-payment-ui',
    visitor: {
      JSXOpeningElement(path, state) {
        if (!isTargetFile(state)) return;
        if (!t.isJSXIdentifier(path.node.name, { name: 'InstallmentRow' })) return;

        const alreadyAdded = path.node.attributes.some((attribute) => (
          t.isJSXAttribute(attribute)
          && t.isJSXIdentifier(attribute.name, { name: 'autoPaymentDay' })
        ));
        if (alreadyAdded) return;

        path.node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier('autoPaymentDay'),
            t.jsxExpressionContainer(
              t.logicalExpression(
                '&&',
                t.identifier('detail'),
                t.memberExpression(t.identifier('detail'), t.identifier('auto_payment_day')),
              ),
            ),
          ),
        );
      },

      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id || path.node.id.name !== 'InstallmentRow') return;

        const params = path.node.params;
        if (params.length > 0 && t.isObjectPattern(params[0])) {
          const hasAutoPaymentDay = params[0].properties.some((property) => (
            t.isObjectProperty(property)
            && t.isIdentifier(property.key, { name: 'autoPaymentDay' })
          ));

          if (!hasAutoPaymentDay) {
            params[0].properties.push(
              t.objectProperty(
                t.identifier('autoPaymentDay'),
                t.identifier('autoPaymentDay'),
                false,
                true,
              ),
            );
          }
        }

        path.traverse({
          ConditionalExpression(conditionalPath) {
            if (!isPaidStatusTest(conditionalPath.node.test)) return;

            const original = t.cloneNode(conditionalPath.node, true);
            conditionalPath.replaceWith(
              t.conditionalExpression(
                t.identifier('autoPaymentDay'),
                autoPaymentBadge(),
                original,
              ),
            );
            conditionalPath.skip();
          },
        });
      },

      CallExpression(path, state) {
        if (!isTargetFile(state)) return;
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        if (!t.isIdentifier(callee.object, { name: 'StyleSheet' })) return;
        if (!t.isIdentifier(callee.property, { name: 'create' })) return;
        if (!path.node.arguments.length || !t.isObjectExpression(path.node.arguments[0])) return;

        const stylesObject = path.node.arguments[0];

        if (!hasObjectKey(stylesObject, 'autoPayBadge')) {
          stylesObject.properties.push(
            prop('autoPayBadge', t.objectExpression([
              prop('minWidth', num(78)),
              prop('height', num(50)),
              prop('borderRadius', num(16)),
              prop('backgroundColor', str('#ede9fe')),
              prop('alignItems', str('center')),
              prop('justifyContent', str('center')),
              prop('paddingHorizontal', num(10)),
            ])),
          );
        }

        if (!hasObjectKey(stylesObject, 'autoPayText')) {
          stylesObject.properties.push(
            prop('autoPayText', t.objectExpression([
              prop('color', str('#6d28d9')),
              prop('fontSize', num(13)),
              prop('fontWeight', str('900')),
              prop('textAlign', str('center')),
            ])),
          );
        }
      },
    },
  };
};
