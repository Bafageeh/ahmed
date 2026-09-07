module.exports = function secureVaultBanksAddButton({ types: t, template }) {
  const inNamedFunction = (path, name) => {
    const fn = path.findParent((parent) =>
      parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression()
    );
    if (!fn) return false;
    if (fn.isFunctionDeclaration()) return t.isIdentifier(fn.node.id, { name });
    const parent = fn.parentPath;
    return Boolean(parent && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name }));
  };

  const styleMemberName = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return null;
    const expression = attr.value.expression;
    if (!t.isMemberExpression(expression)) return null;
    if (!t.isIdentifier(expression.object, { name: 'styles' })) return null;
    return t.isIdentifier(expression.property) ? expression.property.name : null;
  };

  const hasBanksTitle = (node) => {
    if (!t.isJSXElement(node)) return false;
    return node.children.some((child) => {
      if (!t.isJSXElement(child)) return false;
      const opening = child.openingElement;
      if (!t.isJSXIdentifier(opening.name, { name: 'Text' })) return false;
      return child.children.some((textChild) =>
        t.isJSXText(textChild) && textChild.value.trim() === 'البنوك'
      );
    });
  };

  return {
    name: 'secure-vault-banks-add-button',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        const existingLucideImport = programPath.node.body.find(
          (node) => t.isImportDeclaration(node) && node.source.value === 'lucide-react-native'
        );
        if (existingLucideImport) {
          const hasLandmark = existingLucideImport.specifiers.some(
            (specifier) =>
              t.isImportSpecifier(specifier) &&
              t.isIdentifier(specifier.imported, { name: 'Landmark' })
          );
          if (!hasLandmark) {
            existingLucideImport.specifiers.push(
              t.importSpecifier(t.identifier('Landmark'), t.identifier('Landmark'))
            );
          }
        } else {
          programPath.unshiftContainer(
            'body',
            t.importDeclaration(
              [t.importSpecifier(t.identifier('Landmark'), t.identifier('Landmark'))],
              t.stringLiteral('lucide-react-native')
            )
          );
        }

        let patched = false;
        programPath.traverse({
          JSXElement(path) {
            if (patched || !inNamedFunction(path, 'SecureVaultScreen')) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'View' })) return;
            if (styleMemberName(opening) !== 'topBar') return;
            if (!hasBanksTitle(path.node)) return;

            const alreadyExists = path.node.children.some((child) => {
              if (!t.isJSXElement(child)) return false;
              const attr = child.openingElement.attributes.find(
                (item) =>
                  t.isJSXAttribute(item) &&
                  t.isJSXIdentifier(item.name, { name: 'accessibilityLabel' }) &&
                  t.isStringLiteral(item.value) &&
                  item.value.value === 'إضافة بنك'
              );
              return Boolean(attr);
            });
            if (alreadyExists) {
              patched = true;
              return;
            }

            const addButton = template.expression.ast(`
              <TouchableOpacity
                onPress={startAddBank}
                activeOpacity={0.72}
                accessibilityLabel="إضافة بنك"
                style={{
                  position: 'absolute',
                  right: 16,
                  top: 11,
                  width: 50,
                  height: 50,
                  borderRadius: 17,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#dbe3ee',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark size={27} strokeWidth={2.15} color="#0f172a" />
                  <Text style={{
                    position: 'absolute',
                    right: -3,
                    bottom: -7,
                    color: '#0f172a',
                    fontSize: 22,
                    lineHeight: 24,
                    fontWeight: '900',
                  }}>+</Text>
                </View>
              </TouchableOpacity>
            `, { plugins: ['jsx'] });

            path.node.children.push(addButton);
            patched = true;
            path.skip();
          },
        });
      },
    },
  };
};
