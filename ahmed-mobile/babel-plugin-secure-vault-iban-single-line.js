module.exports = function secureVaultIbanSingleLine({ types: t, template }) {
  const attrValue = (opening, name) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })
    );
    if (!attr) return null;
    if (t.isStringLiteral(attr.value)) return attr.value.value;
    return null;
  };

  const inNamedFunction = (path, name) => {
    const fn = path.findParent((parent) =>
      parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression()
    );
    if (!fn) return false;
    if (fn.isFunctionDeclaration()) return t.isIdentifier(fn.node.id, { name });
    const parent = fn.parentPath;
    return Boolean(parent && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name }));
  };

  const insideConditional = (path, name) => Boolean(path.findParent((parent) =>
    parent.isConditionalExpression() && t.isIdentifier(parent.node.test, { name })
  ));

  return {
    name: 'secure-vault-iban-single-line',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        const hasClipboardImport = programPath.node.body.some((node) =>
          t.isImportDeclaration(node) && node.source.value === 'expo-clipboard'
        );
        if (!hasClipboardImport) {
          programPath.unshiftContainer(
            'body',
            t.importDeclaration(
              [t.importNamespaceSpecifier(t.identifier('Clipboard'))],
              t.stringLiteral('expo-clipboard')
            )
          );
        }

        let accountCardReplaced = false;
        let secretCardReplaced = false;
        let customerCredentialsPatched = false;
        let customerInputPatched = false;

        programPath.traverse({
          FunctionDeclaration(path) {
            if (t.isIdentifier(path.node.id, { name: 'BankAccountCard' }) && !accountCardReplaced) {
              const body = template.statements.ast(`
                const iban = String(item.iban || item.username || '').trim();
                const accountNumber = String(item.account_number || item.purpose || '').trim();

                const copyValue = async (value) => {
                  const normalized = String(value || '').trim();
                  if (!normalized) return;
                  await Clipboard.setStringAsync(normalized);
                };

                const AccountNumberLine = ({ label, value, isIban = false }) => (
                  <View style={styles.bankAccountCompactRow}>
                    <View style={styles.bankAccountCopyValueWrap}>
                      <View style={styles.bankAccountCopyTextWrap}>
                        <Text
                          style={isIban ? styles.bankAccountIbanSingleLine : styles.bankAccountNumberValue}
                          selectable
                          numberOfLines={1}
                          allowFontScaling={false}
                        >
                          {value || '—'}
                        </Text>
                      </View>
                      {value ? (
                        <TouchableOpacity
                          accessibilityLabel={\`نسخ \${label}\`}
                          onPress={() => copyValue(value)}
                          activeOpacity={0.7}
                          style={styles.bankAccountCopyButton}
                        >
                          <Text style={styles.bankAccountCopyIcon}>⧉</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.bankAccountCompactLabel}>{label}</Text>
                  </View>
                );

                return <View style={[styles.bankAccountCompactCard, nested && styles.bankAccountCompactNested]}>
                  <View style={styles.siteActions}><TouchableOpacity style={styles.iconAction} onPress={onEdit}><Text>✏️</Text></TouchableOpacity><TouchableOpacity style={styles.iconAction} onPress={onDelete}><Text>🗑️</Text></TouchableOpacity></View>
                  <AccountNumberLine label="الآيبان" value={iban} isIban />
                  <View style={styles.bankAccountCompactDivider} />
                  <AccountNumberLine label="رقم الحساب" value={accountNumber} />
                </View>;
              `, { plugins: ['jsx'] });

              path.node.body.body = body;
              accountCardReplaced = true;
              path.skip();
              return;
            }

            if (t.isIdentifier(path.node.id, { name: 'SecretCard' }) && !secretCardReplaced) {
              const body = template.statements.ast(`
                const hasLogin = item.has_username || item.has_password || item.username || item.password;
                if (!hasLogin) return <View style={styles.secretCard}><Text style={styles.noLogin}>لا توجد بيانات دخول محفوظة لهذا البنك.</Text></View>;
                const customerNumber = revealed ? (item.security_question || '—') : '••••••••';
                return <View style={styles.secretCard}>
                  <SecretRow label="رقم العميل" value={customerNumber} />
                  <SecretRow label="اسم المستخدم" value={revealed ? (item.username || '—') : (item.has_username ? '••••••••' : '—')} />
                  <SecretRow label="كلمة المرور" value={revealed ? (item.password || '—') : (item.has_password ? '••••••••••' : '—')} />
                  <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity>
                </View>;
              `, { plugins: ['jsx'] });

              path.node.body.body = body;
              secretCardReplaced = true;
              path.skip();
            }
          },

          JSXElement(path) {
            if (customerInputPatched) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'FormInput' })) return;
            if (attrValue(opening, 'label') !== 'اسم المستخدم') return;
            if (!insideConditional(path, 'isBankLogin')) return;

            const customerInput = template.expression.ast(`
              <FormInput
                label="رقم العميل"
                value={form.security_question}
                onChangeText={(value) => setField('security_question', value)}
                autoCapitalize="none"
              />
            `, { plugins: ['jsx'] });
            path.insertAfter(customerInput);
            customerInputPatched = true;
          },

          JSXText(path) {
            if (!insideConditional(path, 'isBankLogin')) return;
            const value = String(path.node.value || '');
            if (!value.includes('اسم المستخدم وكلمة المرور فقط')) return;
            path.node.value = value.replace(
              'اسم المستخدم وكلمة المرور فقط، وتُحفظ البيانات مشفرة.',
              'رقم العميل واسم المستخدم وكلمة المرور تُحفظ مشفرة.'
            );
          },

          ObjectExpression(path) {
            const parent = path.parentPath;

            if (
              !customerCredentialsPatched &&
              parent && parent.isCallExpression() &&
              inNamedFunction(path, 'startBankCredentials') &&
              t.isIdentifier(parent.node.callee, { name: 'openForm' }) &&
              t.isStringLiteral(parent.node.arguments[0], { value: 'bankLogin' }) &&
              parent.node.arguments[1] === path.node
            ) {
              const hasCustomerNumber = path.node.properties.some((property) =>
                t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'security_question' })
              );
              if (!hasCustomerNumber) {
                path.node.properties.push(
                  t.objectProperty(
                    t.identifier('security_question'),
                    t.logicalExpression(
                      '||',
                      t.memberExpression(t.identifier('full'), t.identifier('security_question')),
                      t.stringLiteral('')
                    )
                  )
                );
              }
              customerCredentialsPatched = true;
            }

            if (!parent || !parent.isCallExpression()) return;
            if (!t.isMemberExpression(parent.node.callee)) return;
            if (!t.isIdentifier(parent.node.callee.object, { name: 'StyleSheet' })) return;
            if (!t.isIdentifier(parent.node.callee.property, { name: 'create' })) return;

            const hasCopyWrap = path.node.properties.some((property) =>
              t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'bankAccountCopyValueWrap' })
            );
            if (hasCopyWrap) return;

            path.node.properties.push(
              t.objectProperty(
                t.identifier('bankAccountCopyValueWrap'),
                t.objectExpression([
                  t.objectProperty(t.identifier('flex'), t.numericLiteral(1)),
                  t.objectProperty(t.identifier('flexDirection'), t.stringLiteral('row')),
                  t.objectProperty(t.identifier('alignItems'), t.stringLiteral('center')),
                  t.objectProperty(t.identifier('gap'), t.numericLiteral(6)),
                  t.objectProperty(t.identifier('minWidth'), t.numericLiteral(0)),
                ])
              ),
              t.objectProperty(
                t.identifier('bankAccountCopyTextWrap'),
                t.objectExpression([
                  t.objectProperty(t.identifier('flex'), t.numericLiteral(1)),
                  t.objectProperty(t.identifier('minWidth'), t.numericLiteral(0)),
                  t.objectProperty(t.identifier('minHeight'), t.numericLiteral(30)),
                  t.objectProperty(t.identifier('justifyContent'), t.stringLiteral('center')),
                  t.objectProperty(t.identifier('overflow'), t.stringLiteral('visible')),
                ])
              ),
              t.objectProperty(
                t.identifier('bankAccountIbanSingleLine'),
                t.objectExpression([
                  t.objectProperty(t.identifier('color'), t.stringLiteral('#0f172a')),
                  t.objectProperty(t.identifier('fontSize'), t.numericLiteral(12.5)),
                  t.objectProperty(t.identifier('lineHeight'), t.numericLiteral(20)),
                  t.objectProperty(t.identifier('fontWeight'), t.stringLiteral('800')),
                  t.objectProperty(t.identifier('textAlign'), t.stringLiteral('left')),
                  t.objectProperty(t.identifier('includeFontPadding'), t.booleanLiteral(true)),
                  t.objectProperty(t.identifier('paddingVertical'), t.numericLiteral(1)),
                ])
              ),
              t.objectProperty(
                t.identifier('bankAccountCopyButton'),
                t.objectExpression([
                  t.objectProperty(t.identifier('width'), t.numericLiteral(27)),
                  t.objectProperty(t.identifier('height'), t.numericLiteral(27)),
                  t.objectProperty(t.identifier('borderRadius'), t.numericLiteral(9)),
                  t.objectProperty(t.identifier('backgroundColor'), t.stringLiteral('#e8f3ff')),
                  t.objectProperty(t.identifier('alignItems'), t.stringLiteral('center')),
                  t.objectProperty(t.identifier('justifyContent'), t.stringLiteral('center')),
                  t.objectProperty(t.identifier('flexShrink'), t.numericLiteral(0)),
                ])
              ),
              t.objectProperty(
                t.identifier('bankAccountCopyIcon'),
                t.objectExpression([
                  t.objectProperty(t.identifier('color'), t.stringLiteral('#1d4ed8')),
                  t.objectProperty(t.identifier('fontSize'), t.numericLiteral(14)),
                  t.objectProperty(t.identifier('fontWeight'), t.stringLiteral('900')),
                ])
              )
            );
          },
        });
      },
    },
  };
};
