'use strict';

module.exports = function appShellSettingsVaultTab({ types: t }) {
  const getObjectProperty = (object, name) => object.properties.find((property) =>
    t.isObjectProperty(property) && (
      t.isIdentifier(property.key, { name }) || t.isStringLiteral(property.key, { value: name })
    )
  );
  const setJsxStringAttribute = (opening, name, value) => {
    const attribute = opening.attributes.find((item) => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name }));
    if (attribute) attribute.value = t.stringLiteral(value);
    else opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value)));
  };

  return {
    name: 'appshell-settings-vault-tab',
    visitor: {
      Program(programPath, state) {
        if (!String(state.filename || '').endsWith('AppShell.js')) return;
        let settingsTabPatched = false;
        let reportsHeaderRemoved = false;
        let settingsScreenFound = false;

        programPath.traverse({
          VariableDeclarator(path) {
            if (!t.isIdentifier(path.node.id, { name: 'tabs' }) || !t.isArrayExpression(path.node.init)) return;
            for (const tab of path.node.init.elements) {
              if (!t.isObjectExpression(tab)) continue;
              const key = getObjectProperty(tab, 'key');
              if (!key || !t.isStringLiteral(key.value) || !['more', 'secureVault'].includes(key.value.value)) continue;
              key.value = t.stringLiteral('more');
              const label = getObjectProperty(tab, 'label');
              const icon = getObjectProperty(tab, 'icon');
              if (label) label.value = t.stringLiteral('الإعدادات');
              if (icon) icon.value = t.stringLiteral('settings');
              settingsTabPatched = true;
            }
          },
          FunctionDeclaration(path) {
            if (t.isIdentifier(path.node.id, { name: 'ReportsScreen' })) {
              path.traverse({
                JSXElement(innerPath) {
                  const opening = innerPath.node.openingElement;
                  if (t.isJSXIdentifier(opening.name, { name: 'Header' })) {
                    innerPath.remove();
                    reportsHeaderRemoved = true;
                    return;
                  }
                  if (!t.isJSXIdentifier(opening.name, { name: 'Quick' })) return;
                  const title = opening.attributes.find((attribute) => t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'title' }));
                  if (title && t.isStringLiteral(title.value) && ['إعدادات', 'الإعدادات', 'مزيد'].includes(title.value.value)) innerPath.remove();
                },
              });
            }
            if (t.isIdentifier(path.node.id, { name: 'MoreScreen' })) {
              path.traverse({
                JSXOpeningElement(innerPath) {
                  if (t.isJSXIdentifier(innerPath.node.name, { name: 'SettingsScreen' })) {
                    settingsScreenFound = true;
                    innerPath.stop();
                    return;
                  }
                  if (!t.isJSXIdentifier(innerPath.node.name, { name: 'Header' })) return;
                  setJsxStringAttribute(innerPath.node, 'title', 'الإعدادات');
                  setJsxStringAttribute(innerPath.node, 'subtitle', 'الإعدادات والاختصارات.');
                  setJsxStringAttribute(innerPath.node, 'icon', 'settings');
                  settingsScreenFound = true;
                  innerPath.stop();
                },
              });
            }
          },
        });
        if (!settingsTabPatched) throw programPath.buildCodeFrameError('تعذر تثبيت تبويب الإعدادات في الشريط السفلي.');
        if (!settingsScreenFound) throw programPath.buildCodeFrameError('تعذر ربط شاشة الإعدادات.');
        if (!reportsHeaderRemoved) throw programPath.buildCodeFrameError('تعذر تنظيف رأس شاشة التقارير.');
      },
    },
  };
};
