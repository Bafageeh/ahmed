'use strict';

module.exports = function creditCardBankLogosPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/CreditCardDebtsScreen.js');
  };

  const styleName = (openingElement) => {
    const attr = openingElement.attributes.find((attribute) => (
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name: 'style' })
      && t.isJSXExpressionContainer(attribute.value)
    ));
    if (!attr) return null;
    const expression = attr.value.expression;
    if (!t.isMemberExpression(expression)) return null;
    if (!t.isIdentifier(expression.object, { name: 'styles' })) return null;
    if (!t.isIdentifier(expression.property)) return null;
    return expression.property.name;
  };

  const logoElement = () => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('BankLogo'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('bankName'),
          t.jsxExpressionContainer(
            t.memberExpression(t.identifier('item'), t.identifier('bank_name')),
          ),
        ),
        t.jsxAttribute(
          t.jsxIdentifier('size'),
          t.jsxExpressionContainer(t.numericLiteral(40)),
        ),
      ],
      true,
    ),
    null,
    [],
    true,
  );

  return {
    name: 'ahmed-credit-card-bank-logos',
    visitor: {
      Program(path, state) {
        if (!isTargetFile(state)) return;
        const hasImport = path.node.body.some((node) => (
          t.isImportDeclaration(node) && node.source.value === './BankLogo'
        ));
        if (!hasImport) {
          path.unshiftContainer(
            'body',
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier('BankLogo'))],
              t.stringLiteral('./BankLogo'),
            ),
          );
        }
      },

      JSXElement(path, state) {
        if (!isTargetFile(state)) return;
        const opening = path.node.openingElement;
        if (!t.isJSXIdentifier(opening.name, { name: 'View' })) return;
        if (styleName(opening) !== 'cardIcon') return;

        path.node.children = [logoElement()];
        path.skip();
      },
    },
  };
};
