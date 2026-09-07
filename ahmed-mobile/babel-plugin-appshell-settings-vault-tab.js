'use strict';

module.exports = function appShellSettingsVaultTab({ types: t }) {
  const getObjectProperty = (objectExpression, name) => objectExpression.properties.find((property) => {
    if (!t.isObjectProperty(property)) return false;
    return (t.isIdentifier(property.key) && property.key.name === name) || (t.isStringLiteral(property.key) && property.key.value === name);
  });

  const setJsxStringAttribute = (openingElement, name, value) => {
    const attr = openingElement.attributes.find((item) => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name }));
    if (attr) attr.value = t.stringLiteral(value);
    else openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value)));
  };

  const isStylesGrid = (openingElement) => {
    const styleAttr = openingElement.attributes.find((item) => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' }));
    if (!styleAttr || !t.isJSXExpressionContainer(styleAttr.value)) return false;
    const expr = styleAttr.value.expression;
    return t.isMemberExpression(expr) && t.isIdentifier(expr.object, { name: 'styles' }) && t.isIdentifier(expr.property, { name: 'grid' });
  };

  const makeSettingsQuick = () => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('Quick'),
      [
        t.jsxAttribute(t.jsxIdentifier('title'), t.stringLiteral('إعدادات')),
        t.jsxAttribute(t.jsxIdentifier('text'), t.stringLiteral('الإعدادات والاختصارات')),
        t.jsxAttribute(t.jsxIdentifier('icon'), t.stringLiteral('settings')),
        t.jsxAttribute(
          t.jsxIdentifier('onPress'),
          t.jsxExpressionContainer(
            t.arrowFunctionExpression([], t.callExpression(t.identifier('goTo'), [t.stringLiteral('more')]))
          )
        ),
      ],
      true
    ),
    null,
    [],
    true
  );

  return {
    name: 'appshell-settings-vault-tab',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('AppShell.js')) return;

        let tabsPatched = false;
        let settingsCardAdded = false;
        let settingsHeaderPatched = false;

        programPath.traverse({
          VariableDeclarator(path) {
            if (!t.isIdentifier(path.node.id, { name: 'tabs' }) || !t.isArrayExpression(path.node.init)) return;

            for (const element of path.node.init.elements) {
              if (!t.isObjectExpression(element)) continue;
              const keyProp = getObjectProperty(element, 'key');
              if (!keyProp || !t.isStringLiteral(keyProp.value, { value: 'more' })) continue;

              keyProp.value = t.stringLiteral('secureVault');
              const labelProp = getObjectProperty(element, 'label');
              const iconProp = getObjectProperty(element, 'icon');
              if (labelProp) labelProp.value = t.stringLiteral('الخزنة الآمنة');
              if (iconProp) iconProp.value = t.stringLiteral('settings');
              tabsPatched = true;
            }
          },

          FunctionDeclaration(path) {
            if (t.isIdentifier(path.node.id, { name: 'ReportsScreen' })) {
              path.traverse({
                JSXElement(innerPath) {
                  const opening = innerPath.node.openingElement;
                  if (!t.isJSXIdentifier(opening.name, { name: 'View' }) || !isStylesGrid(opening)) return;

                  const alreadyExists = innerPath.node.children.some((child) => {
                    if (!t.isJSXElement(child)) return false;
                    const childOpening = child.openingElement;
                    if (!t.isJSXIdentifier(childOpening.name, { name: 'Quick' })) return false;
                    const titleAttr = childOpening.attributes.find((item) => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'title' }));
                    return titleAttr && t.isStringLiteral(titleAttr.value, { value: 'إعدادات' });
                  });

                  if (!alreadyExists) innerPath.node.children.push(makeSettingsQuick());
                  settingsCardAdded = true;
                  innerPath.stop();
                },
              });
            }

            if (t.isIdentifier(path.node.id, { name: 'MoreScreen' })) {
              path.traverse({
                JSXOpeningElement(innerPath) {
                  if (!t.isJSXIdentifier(innerPath.node.name, { name: 'Header' })) return;
                  setJsxStringAttribute(innerPath.node, 'title', '#S-150 إعدادات');
                  setJsxStringAttribute(innerPath.node, 'subtitle', 'الإعدادات والاختصارات.');
                  setJsxStringAttribute(innerPath.node, 'icon', 'settings');
                  settingsHeaderPatched = true;
                  innerPath.stop();
                },
              });
            }
          },
        });

        if (!tabsPatched) throw programPath.buildCodeFrameError('تعذر استبدال تبويب مزيد بالخزنة الآمنة.');
        if (!settingsCardAdded) throw programPath.buildCodeFrameError('تعذر إضافة بطاقة الإعدادات إلى شاشة S-130.');
        if (!settingsHeaderPatched) throw programPath.buildCodeFrameError('تعذر تحويل شاشة مزيد إلى الإعدادات.');
      },
    },
  };
};
