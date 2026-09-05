module.exports = function secureVaultIbanSingleLine({ types: t }) {
  const hasAttribute = (opening, name) => opening.attributes.some(
    (attribute) => t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name }),
  );

  return {
    name: 'secure-vault-iban-single-line',
    visitor: {
      JSXOpeningElement(path, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        const opening = path.node;
        if (!t.isJSXIdentifier(opening.name, { name: 'Text' })) return;

        const styleAttribute = opening.attributes.find(
          (attribute) => t.isJSXAttribute(attribute)
            && t.isJSXIdentifier(attribute.name, { name: 'style' })
            && t.isJSXExpressionContainer(attribute.value),
        );
        if (!styleAttribute) return;

        const styleExpression = styleAttribute.value.expression;
        const isIbanValue = t.isMemberExpression(styleExpression)
          && !styleExpression.computed
          && t.isIdentifier(styleExpression.object, { name: 'styles' })
          && t.isIdentifier(styleExpression.property, { name: 'bankAccountCompactValue' });
        if (!isIbanValue) return;

        if (!hasAttribute(opening, 'numberOfLines')) {
          opening.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier('numberOfLines'),
              t.jsxExpressionContainer(t.numericLiteral(1)),
            ),
          );
        }
        if (!hasAttribute(opening, 'adjustsFontSizeToFit')) {
          opening.attributes.push(t.jsxAttribute(t.jsxIdentifier('adjustsFontSizeToFit'), null));
        }
        if (!hasAttribute(opening, 'minimumFontScale')) {
          opening.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier('minimumFontScale'),
              t.jsxExpressionContainer(t.numericLiteral(0.8)),
            ),
          );
        }
      },
    },
  };
};
