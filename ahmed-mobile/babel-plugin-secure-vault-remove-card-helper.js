module.exports = function secureVaultRemoveCardHelper({ types: t }) {
  const styleNameOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((attribute) =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return null;
    const expression = attr.value.expression;
    return t.isMemberExpression(expression) &&
      t.isIdentifier(expression.object, { name: 'styles' }) &&
      t.isIdentifier(expression.property)
      ? expression.property.name
      : null;
  };

  return {
    name: 'secure-vault-remove-card-helper',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        programPath.traverse({
          JSXElement(elementPath) {
            const opening = elementPath.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'Text' })) return;
            if (styleNameOf(opening) !== 'securityHint') return;

            let isCardHelper = false;
            elementPath.traverse({
              StringLiteral(stringPath) {
                const value = String(stringPath.node.value || '');
                if (
                  value.includes('بطاقة مدى') ||
                  value.includes('رقم البطاقة ورقم سداد') ||
                  value.includes('رقم سداد اختياري لأن بعض البطاقات الائتمانية')
                ) {
                  isCardHelper = true;
                }
              },
              JSXText(textPath) {
                const value = String(textPath.node.value || '');
                if (value.includes('بطاقة مدى') || value.includes('رقم سداد')) {
                  isCardHelper = true;
                }
              },
            });

            if (isCardHelper) {
              elementPath.replaceWith(t.jsxExpressionContainer(t.nullLiteral()));
              elementPath.skip();
            }
          },
        });
      },
    },
  };
};
