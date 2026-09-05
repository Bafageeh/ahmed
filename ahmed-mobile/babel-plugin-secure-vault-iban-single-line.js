module.exports = function secureVaultIbanSingleLine({ types: t, template }) {
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

        programPath.traverse({
          FunctionDeclaration(path) {
            if (!t.isIdentifier(path.node.id, { name: 'BankAccountCard' }) || accountCardReplaced) return;

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
                    <Text
                      style={isIban ? styles.bankAccountCompactValue : styles.bankAccountNumberValue}
                      selectable
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={isIban ? 0.76 : 0.82}
                    >
                      {value || '—'}
                    </Text>
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
          },

          ObjectExpression(path) {
            const parent = path.parentPath;
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
