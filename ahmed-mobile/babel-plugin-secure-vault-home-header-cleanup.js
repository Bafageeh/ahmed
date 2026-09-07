module.exports = function secureVaultHomeHeaderCleanup({ types: t, template }) {
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

  const viewEquals = (node, value) =>
    t.isBinaryExpression(node, { operator: '===' }) &&
    t.isIdentifier(node.left, { name: 'view' }) &&
    t.isStringLiteral(node.right, { value });

  const isBankDetailTopbarTest = (node) =>
    t.isLogicalExpression(node, { operator: '&&' }) &&
    viewEquals(node.left, 'bank') &&
    t.isIdentifier(node.right, { name: 'selectedGroup' });

  return {
    name: 'secure-vault-home-header-cleanup',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let homeViewPatched = false;
        let topBarPatched = false;
        let floatingMenuPatched = false;
        let dropdownPatched = false;
        let messagePatched = false;

        programPath.traverse({
          FunctionDeclaration(path) {
            if (homeViewPatched || !t.isIdentifier(path.node.id, { name: 'HomeView' })) return;
            const body = template.statements.ast(`
              return <View style={[styles.homeWrap, { paddingTop: 0 }]}> 
                <TouchableOpacity style={styles.homeCard} activeOpacity={0.86} onPress={onBanks}>
                  <View style={styles.homeIconBox}><Text style={styles.homeEmoji}>🏦</Text></View>
                  <View style={styles.homeTextBlock}>
                    <Text style={styles.homeTitle}>البنوك</Text>
                    <Text style={styles.homeSubtitle}>حسابات الدخول والبطاقات البنكية</Text>
                    <Text style={styles.homeCount}>{bankCount} بنك</Text>
                  </View>
                  <Text style={styles.chevron}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.homeCard} activeOpacity={0.86} onPress={onSites}>
                  <View style={styles.homeIconBox}><Text style={styles.homeEmoji}>🌐</Text></View>
                  <View style={styles.homeTextBlock}>
                    <Text style={styles.homeTitle}>مواقع أو تطبيقات</Text>
                    <Text style={styles.homeSubtitle}>أسماء المستخدمين وكلمات المرور</Text>
                    <Text style={styles.homeCount}>{siteCount} حساب</Text>
                  </View>
                  <Text style={styles.chevron}>‹</Text>
                </TouchableOpacity>
              </View>;
            `, { plugins: ['jsx'] });
            path.node.body.body = body;
            homeViewPatched = true;
            path.skip();
          },

          ConditionalExpression(path) {
            if (!inNamedFunction(path, 'SecureVaultScreen')) return;

            if (!topBarPatched && isBankDetailTopbarTest(path.node.test)) {
              const currentAlternate = t.cloneNode(path.node.alternate, true);
              const homeBar = template.expression.ast(`
                <View style={styles.topBar}>
                  <TouchableOpacity
                    onPress={goBack}
                    activeOpacity={0.72}
                    accessibilityLabel="رجوع"
                    style={{
                      position: 'absolute',
                      left: 16,
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
                    <Text style={{ color: '#0f172a', fontSize: 38, lineHeight: 40, fontWeight: '500', marginTop: -3 }}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.topTitle}>الخزنة الآمنة</Text>
                </View>
              `, { plugins: ['jsx'] });
              path.node.alternate = t.conditionalExpression(
                t.binaryExpression('===', t.identifier('view'), t.stringLiteral('home')),
                homeBar,
                currentAlternate
              );
              topBarPatched = true;
              return;
            }

            const consequent = path.node.consequent;
            if (!t.isJSXElement(consequent)) return;
            const styleName = styleMemberName(consequent.openingElement);

            if (!floatingMenuPatched && styleName === 'floatingMenuButton') {
              path.node.test = t.logicalExpression(
                '&&',
                t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('home')),
                path.node.test
              );
              floatingMenuPatched = true;
              return;
            }

            if (!dropdownPatched && styleName === 'dropdownMenu') {
              path.node.test = t.logicalExpression(
                '&&',
                t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('home')),
                path.node.test
              );
              dropdownPatched = true;
              return;
            }

            if (!messagePatched && styleName === 'message') {
              path.node.test = t.logicalExpression(
                '&&',
                t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('home')),
                path.node.test
              );
              messagePatched = true;
            }
          },
        });
      },
    },
  };
};
