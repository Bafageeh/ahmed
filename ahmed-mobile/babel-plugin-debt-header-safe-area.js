'use strict';

module.exports = function debtHeaderSafeAreaPlugin({ types: t, template }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const styleMember = (name) => t.memberExpression(t.identifier('styles'), t.identifier(name));

  const styleAttributeName = (element) => {
    const attribute = element.openingElement.attributes.find((item) => (
      t.isJSXAttribute(item)
      && t.isJSXIdentifier(item.name, { name: 'style' })
      && t.isJSXExpressionContainer(item.value)
    ));
    if (!attribute) return null;
    const expression = attribute.value.expression;
    if (!t.isMemberExpression(expression) || !t.isIdentifier(expression.object, { name: 'styles' })) return null;
    return t.isIdentifier(expression.property) ? expression.property.name : null;
  };

  const jsxText = (styleExpression, text) => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('Text'),
      [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(styleExpression))],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier('Text')),
    [t.jsxText(text)],
    false,
  );

  const mainTitleNode = () => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('View'),
      [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(styleMember('topTitleWrap')))],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier('View')),
    [
      jsxText(t.arrayExpression([styleMember('topTitle'), styleMember('mainTopTitle')]), 'ديوني'),
      jsxText(styleMember('screenCode'), '#S-124'),
    ],
    false,
  );

  const objectExpression = (code) => template.expression.ast(`(${code})`);

  const setStyle = (stylesObject, name, value) => {
    const property = stylesObject.properties.find((item) => (
      t.isObjectProperty(item)
      && ((t.isIdentifier(item.key) && item.key.name === name) || (t.isStringLiteral(item.key) && item.key.value === name))
    ));

    if (property) {
      property.value = value;
    } else {
      stylesObject.properties.push(t.objectProperty(t.identifier(name), value));
    }
  };

  return {
    name: 'ahmed-debt-header-safe-area',
    visitor: {
      Program(path, state) {
        if (!isTargetFile(state)) return;

        const reactNativeImport = path.node.body.find((node) => (
          t.isImportDeclaration(node) && node.source.value === 'react-native'
        ));

        if (reactNativeImport) {
          const hasPlatform = reactNativeImport.specifiers.some((specifier) => (
            t.isImportSpecifier(specifier) && t.isIdentifier(specifier.local, { name: 'Platform' })
          ));
          const hasNativeStatusBar = reactNativeImport.specifiers.some((specifier) => (
            t.isImportSpecifier(specifier) && t.isIdentifier(specifier.local, { name: 'NativeStatusBar' })
          ));

          if (!hasPlatform) {
            reactNativeImport.specifiers.push(t.importSpecifier(t.identifier('Platform'), t.identifier('Platform')));
          }
          if (!hasNativeStatusBar) {
            reactNativeImport.specifiers.push(t.importSpecifier(t.identifier('NativeStatusBar'), t.identifier('StatusBar')));
          }
        }
      },

      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id || path.node.id.name !== 'DebtsScreen') return;

        path.traverse({
          JSXElement(jsxPath) {
            const element = jsxPath.node;
            const tagName = t.isJSXIdentifier(element.openingElement.name)
              ? element.openingElement.name.name
              : '';
            const styleName = styleAttributeName(element);

            if (tagName === 'View' && styleName === 'backButton' && element.openingElement.selfClosing) {
              const styleAttribute = element.openingElement.attributes.find((item) => (
                t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' })
              ));
              styleAttribute.value.expression = styleMember('topBarSpacer');
              return;
            }

            if (tagName === 'Text' && styleName === 'topTitle') {
              const text = element.children
                .filter((child) => t.isJSXText(child))
                .map((child) => child.value)
                .join('')
                .trim();

              if (text === '#S-124 ديوني') {
                jsxPath.replaceWith(mainTitleNode());
                jsxPath.skip();
              }
            }
          },
        });
      },

      CallExpression(path, state) {
        if (!isTargetFile(state)) return;
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        if (!t.isIdentifier(callee.object, { name: 'StyleSheet' }) || !t.isIdentifier(callee.property, { name: 'create' })) return;

        const stylesObject = path.node.arguments[0];
        if (!t.isObjectExpression(stylesObject)) return;

        setStyle(stylesObject, 'topBar', objectExpression(`{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 24) + 8 : 8,
          paddingBottom: 8,
          minHeight: Platform.OS === 'android' ? (NativeStatusBar.currentHeight || 24) + 58 : 58,
        }`));

        setStyle(stylesObject, 'backButton', objectExpression(`{
          width: 44,
          height: 44,
          borderRadius: 15,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#dbe3ea',
          alignItems: 'center',
          justifyContent: 'center',
        }`));

        setStyle(stylesObject, 'topBarSpacer', objectExpression(`{ width: 44, height: 44 }`));
        setStyle(stylesObject, 'topTitleWrap', objectExpression(`{
          flex: 1,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }`));
        setStyle(stylesObject, 'topTitle', objectExpression(`{
          flex: 1,
          color: '#0f172a',
          fontSize: 22,
          fontWeight: '900',
          textAlign: 'center',
          textAlignVertical: 'center',
        }`));
        setStyle(stylesObject, 'mainTopTitle', objectExpression(`{ flex: 0 }`));
        setStyle(stylesObject, 'screenCode', objectExpression(`{
          marginTop: 1,
          color: '#94a3b8',
          fontSize: 9,
          fontWeight: '800',
          letterSpacing: 0.2,
          textAlign: 'center',
        }`));
        setStyle(stylesObject, 'content', objectExpression(`{
          paddingHorizontal: 18,
          paddingTop: 6,
          paddingBottom: 36,
        }`));
        setStyle(stylesObject, 'detailContent', objectExpression(`{
          paddingHorizontal: 18,
          paddingTop: 6,
          paddingBottom: 40,
        }`));
      },
    },
  };
};
