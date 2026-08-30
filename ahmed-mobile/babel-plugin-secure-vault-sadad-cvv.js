module.exports = function secureVaultSadadCvv({ types: t, template }) {
  const attrValue = (opening, name) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })
    );
    if (!attr) return null;
    if (t.isStringLiteral(attr.value)) return attr.value.value;
    return null;
  };

  const inFunction = (path, name) => {
    const fn = path.findParent((parent) =>
      parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression()
    );
    if (!fn) return false;
    if (fn.isFunctionDeclaration()) return t.isIdentifier(fn.node.id, { name });
    const parent = fn.parentPath;
    return Boolean(parent && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name }));
  };

  return {
    name: 'secure-vault-sadad-cvv',
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

        let hydratedInserted = false;
        let cvvFormInserted = false;
        let bankCardReplaced = false;

        programPath.traverse({
          VariableDeclarator(path) {
            if (t.isIdentifier(path.node.id, { name: 'emptyForm' }) && t.isObjectExpression(path.node.init)) {
              const hasCvv = path.node.init.properties.some((property) =>
                t.isObjectProperty(property) &&
                ((t.isIdentifier(property.key) && property.key.name === 'card_cvv') ||
                  (t.isStringLiteral(property.key) && property.key.value === 'card_cvv'))
              );
              if (!hasCvv) {
                path.node.init.properties.push(t.objectProperty(t.identifier('card_cvv'), t.stringLiteral('')));
              }
            }

            if (
              !hydratedInserted &&
              t.isIdentifier(path.node.id, { name: 'loaded' }) &&
              inFunction(path, 'loadItems')
            ) {
              const declaration = path.parentPath;
              const injected = template.statements.ast(`
                const hydrated = await Promise.all(loaded.map(async (entry) => {
                  if (getMode(entry) !== 'card' || entry.card_type !== 'credit' || !entry.has_sadad_number) return entry;
                  try {
                    const detailResponse = await fetch(\`\${API_URL}/secure-vault/\${entry.id}\`, {
                      headers: ahmedUserHeaders({ Accept: 'application/json' }),
                    });
                    const detailJson = await detailResponse.json();
                    if (detailResponse.ok && detailJson && detailJson.data) {
                      return { ...entry, sadad_number: detailJson.data.sadad_number || '' };
                    }
                  } catch (error) {}
                  return entry;
                }));
              `);
              declaration.insertAfter(injected);
              hydratedInserted = true;
            }
          },

          CallExpression(path) {
            if (!inFunction(path, 'loadItems')) return;
            if (!t.isIdentifier(path.node.callee)) return;
            if (!['setItems', 'syncCardReminders'].includes(path.node.callee.name)) return;
            if (path.node.arguments.length !== 1 || !t.isIdentifier(path.node.arguments[0], { name: 'loaded' })) return;
            path.node.arguments[0] = t.identifier('hydrated');
          },

          ObjectExpression(path) {
            if (!inFunction(path, 'startEdit')) return;
            const hasCardFields = path.node.properties.some((property) =>
              t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'card_type' })
            );
            if (!hasCardFields) return;
            const hasCvv = path.node.properties.some((property) =>
              t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'card_cvv' })
            );
            if (!hasCvv) {
              path.node.properties.push(
                t.objectProperty(
                  t.identifier('card_cvv'),
                  t.logicalExpression(
                    '||',
                    t.memberExpression(t.identifier('full'), t.identifier('card_cvv')),
                    t.stringLiteral('')
                  )
                )
              );
            }
          },

          FunctionDeclaration(path) {
            if (!t.isIdentifier(path.node.id, { name: 'BankCard' }) || bankCardReplaced) return;

            const body = template.statements.ast(`
              const debt = creditDebts.find((entry) => String(entry.id) === String(item.credit_card_debt_id));
              const credit = item.card_type === 'credit';
              const brand = item.card_type === 'mada' ? 'مدى' : item.card_brand === 'mastercard' ? 'ماستركارد' : 'فيزا';
              const expiry = item.expiry_month && item.expiry_year ? \`\${String(item.expiry_month).padStart(2, '0')}/\${item.expiry_year}\` : '—';
              const cardDisplay = revealed && item.card_number
                ? item.card_number
                : item.card_last_four
                  ? \`••••  \${item.card_last_four}\`
                  : '—';
              const cvvDisplay = revealed ? (item.card_cvv || '—') : (item.has_card_cvv ? '•••' : '—');
              const hasRevealable = item.has_card_number || item.card_last_four || item.has_card_cvv;

              const fetchFullVaultCard = async () => {
                try {
                  const response = await fetch(\`\${API_URL}/secure-vault/\${item.id}\`, {
                    headers: ahmedUserHeaders({ Accept: 'application/json' }),
                  });
                  const json = await response.json();
                  if (response.ok && json && json.data) return json.data;
                } catch (error) {}
                return item;
              };

              const copySadadNumber = async () => {
                const full = item.sadad_number ? item : await fetchFullVaultCard();
                const value = String(full && full.sadad_number ? full.sadad_number : '').trim();
                if (!value) {
                  Alert.alert('رقم سداد', 'لا يوجد رقم سداد محفوظ لهذه البطاقة.');
                  return;
                }
                await Clipboard.setStringAsync(value);
              };

              const copyCardNumber = async () => {
                const full = item.card_number ? item : await fetchFullVaultCard();
                const value = String(full && full.card_number ? full.card_number : '').trim();
                if (!value) {
                  Alert.alert('رقم البطاقة', 'لا يوجد رقم بطاقة محفوظ لهذه البطاقة.');
                  return;
                }
                Alert.alert(
                  'تنبيه مهم',
                  'هذا رقم البطاقة وليس رقم السداد.',
                  [
                    { text: 'إلغاء', style: 'cancel' },
                    {
                      text: 'نسخ',
                      onPress: async () => {
                        await Clipboard.setStringAsync(value);
                      },
                    },
                  ]
                );
              };

              const MiniInfo = ({ label, value, wide = false }) => (
                <View style={{
                  width: wide ? '100%' : '31.5%',
                  minHeight: 52,
                  borderRadius: 15,
                  backgroundColor: '#f8fafc',
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10.5, fontWeight: '800', textAlign: 'right' }}>{label}</Text>
                  <Text numberOfLines={1} style={{ color: '#0f172a', fontSize: 13.5, fontWeight: '900', textAlign: 'right', marginTop: 2 }}>{String(value || '—')}</Text>
                </View>
              );

              const NumberLine = ({ label, value, onCopy, canCopy }) => (
                <View style={{
                  minHeight: 46,
                  borderRadius: 14,
                  backgroundColor: '#f8fafc',
                  paddingHorizontal: 11,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '800', minWidth: 72, textAlign: 'right' }}>{label}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                    <Text selectable numberOfLines={1} style={{ color: '#0f172a', fontSize: 14.5, fontWeight: '900', letterSpacing: 0.3 }}>{String(value || '—')}</Text>
                    {canCopy ? (
                      <TouchableOpacity
                        accessibilityLabel={\`نسخ \${label}\`}
                        onPress={onCopy}
                        activeOpacity={0.7}
                        style={{ width: 27, height: 27, borderRadius: 9, backgroundColor: '#e8f3ff', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ color: '#1d4ed8', fontSize: 14, fontWeight: '900' }}>⧉</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );

              return <View style={{
                backgroundColor: '#fff',
                borderRadius: 22,
                padding: 13,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#e8eef5',
                shadowColor: '#0f172a',
                shadowOpacity: 0.035,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 1,
              }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <NetworkBadge brand={credit ? item.card_brand : 'mada'} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' }}>{item.title || 'بطاقة'}</Text>
                    <Text style={{ color: '#7c8ca3', fontSize: 11.5, fontWeight: '700', textAlign: 'right', marginTop: 2 }}>{credit ? \`ائتمانية • \${brand}\` : 'مدى'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row-reverse', gap: 6 }}>
                    <TouchableOpacity onPress={onEdit} style={{ width: 31, height: 31, borderRadius: 10, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14 }}>✏️</Text></TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} style={{ width: 31, height: 31, borderRadius: 10, backgroundColor: '#fff5f5', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14 }}>🗑️</Text></TouchableOpacity>
                  </View>
                </View>

                <View style={{ gap: 7, marginTop: 10 }}>
                  <NumberLine
                    label="رقم البطاقة"
                    value={cardDisplay}
                    canCopy={Boolean(item.has_card_number || item.card_number)}
                    onCopy={copyCardNumber}
                  />
                  {credit ? (
                    <NumberLine
                      label="رقم السداد"
                      value={item.sadad_number || '—'}
                      canCopy={Boolean(item.has_sadad_number || item.sadad_number)}
                      onCopy={copySadadNumber}
                    />
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 6, marginTop: 8 }}>
                  {credit ? <MiniInfo label="الحد" value={debt ? money(debt.credit_limit) : '—'} /> : null}
                  {credit ? <MiniInfo label="الكشف" value={item.statement_day ? \`يوم \${item.statement_day}\` : '—'} /> : null}
                  <MiniInfo label="الانتهاء" value={expiry} />
                  {credit ? <MiniInfo label="CVV" value={cvvDisplay} /> : null}
                </View>

                {hasRevealable ? (
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-start', marginTop: 9, borderRadius: 999, backgroundColor: revealed ? '#f1f5f9' : '#ecfeff', paddingHorizontal: 12, paddingVertical: 7 }}
                    onPress={onReveal}
                  >
                    <Text style={{ color: revealed ? '#475569' : '#0e7490', fontSize: 11.5, fontWeight: '900' }}>{revealed ? 'إخفاء' : 'فك بيانات البطاقة'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>;
            `, { plugins: ['jsx'] });

            path.node.body.body = body;
            bankCardReplaced = true;
            path.skip();
          },

          JSXElement(path) {
            const opening = path.node.openingElement;
            if (
              t.isJSXIdentifier(opening.name, { name: 'FormInput' }) &&
              attrValue(opening, 'label') === 'رقم البطاقة (اختياري)' &&
              !cvvFormInserted
            ) {
              const cvvInput = template.expression.ast(`
                <FormInput
                  label="CVV (اختياري)"
                  value={String(form.card_cvv || '')}
                  onChangeText={(value) => setField('card_cvv', digitsOnly(value, 4))}
                  keyboardType="number-pad"
                  placeholder="CVV"
                />
              `, { plugins: ['jsx'] });
              path.insertAfter(cvvInput);
              cvvFormInserted = true;
            }
          },
        });
      },
    },
  };
};
