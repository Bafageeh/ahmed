module.exports = function secureVaultSitesTitleSingleLine({ types: t }) {
  const inHomeView = (path) => {
    const fn = path.findParent((parent) => parent.isFunctionDeclaration());
    return Boolean(fn && t.isIdentifier(fn.node.id, { name: 'HomeView' }));
  };

  const hasExactText = (node, value) =>
    t.isJSXElement(node) && node.children.some((child) => t.isJSXText(child) && child.value.trim() === value);

  return {
    name: 'secure-vault-sites-title-single-line',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let patched = false;
        programPath.traverse({
          JSXElement(path) {
            if (patched || !inHomeView(path)) return;
            if (!t.isJSXIdentifier(path.node.openingElement.name, { name: 'Text' })) return;
            if (!hasExactText(path.node, 'مواقع أو تطبيقات')) return;

            const attrs = path.node.openingElement.attributes;
            const styleAttr = attrs.find((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'style' }));
            if (styleAttr) {
              styleAttr.value = t.jsxExpressionContainer(
                t.arrayExpression([
                  t.memberExpression(t.identifier('styles'), t.identifier('homeTitle')),
                  t.objectExpression([
                    t.objectProperty(t.identifier('fontSize'), t.numericLiteral(22)),
                    t.objectProperty(t.identifier('lineHeight'), t.numericLiteral(30)),
                  ]),
                ])
              );
            }

            const hasNumberOfLines = attrs.some((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'numberOfLines' }));
            if (!hasNumberOfLines) {
              attrs.push(t.jsxAttribute(t.jsxIdentifier('numberOfLines'), t.jsxExpressionContainer(t.numericLiteral(1))));
            }

            const hasAdjusts = attrs.some((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'adjustsFontSizeToFit' }));
            if (!hasAdjusts) attrs.push(t.jsxAttribute(t.jsxIdentifier('adjustsFontSizeToFit'), null));

            const hasMinScale = attrs.some((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'minimumFontScale' }));
            if (!hasMinScale) {
              attrs.push(t.jsxAttribute(t.jsxIdentifier('minimumFontScale'), t.jsxExpressionContainer(t.numericLiteral(0.82))));
            }

            patched = true;
            path.skip();
          },
        });
      },
    },
  };
};
