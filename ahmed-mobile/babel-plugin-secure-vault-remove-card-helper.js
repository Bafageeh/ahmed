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

  const hasAttribute = (opening, name) => opening.attributes.some((attribute) =>
    t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name })
  );

  const elementContainsText = (elementPath, wanted) => {
    let found = false;
    elementPath.traverse({
      StringLiteral(stringPath) {
        if (String(stringPath.node.value || '').includes(wanted)) found = true;
      },
      JSXText(textPath) {
        if (String(textPath.node.value || '').includes(wanted)) found = true;
      },
    });
    return found;
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

            const styleName = styleNameOf(opening);

            // Home card: keep "مواقع أو تطبيقات" visually clean on a single line.
            if (styleName === 'homeTitle' && elementContainsText(elementPath, 'مواقع أو تطبيقات')) {
              if (!hasAttribute(opening, 'numberOfLines')) {
                opening.attributes.push(t.jsxAttribute(
                  t.jsxIdentifier('numberOfLines'),
                  t.jsxExpressionContainer(t.numericLiteral(1))
                ));
              }
              if (!hasAttribute(opening, 'adjustsFontSizeToFit')) {
                opening.attributes.push(t.jsxAttribute(t.jsxIdentifier('adjustsFontSizeToFit'), null));
              }
              if (!hasAttribute(opening, 'minimumFontScale')) {
                opening.attributes.push(t.jsxAttribute(
                  t.jsxIdentifier('minimumFontScale'),
                  t.jsxExpressionContainer(t.numericLiteral(0.75))
                ));
              }

              const styleAttr = opening.attributes.find((attribute) =>
                t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })
              );
              if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
                styleAttr.value.expression = t.arrayExpression([
                  styleAttr.value.expression,
                  t.objectExpression([
                    t.objectProperty(t.identifier('fontSize'), t.numericLiteral(21)),
                    t.objectProperty(t.identifier('flexShrink'), t.numericLiteral(1)),
                  ]),
                ]);
              }
              return;
            }

            if (styleName !== 'securityHint') return;

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
