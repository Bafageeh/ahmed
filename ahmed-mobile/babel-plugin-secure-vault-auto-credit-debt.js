module.exports = function secureVaultAutoCreditDebt({ types: t, template }) {
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

  const jsxText = (node) => {
    if (!t.isJSXElement(node)) return '';
    return node.children
      .filter((child) => t.isJSXText(child))
      .map((child) => child.value)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const containsDebtPickerTitle = (node) => {
    if (!t.isJSXElement(node)) return false;
    return node.children.some((child) =>
      t.isJSXElement(child) && jsxText(child) === 'الحد الائتماني من شاشة المديونية'
    );
  };

  const hasErrorMessage = (node, text) => {
    if (!node) return false;
    let found = false;
    t.traverseFast(node, (child) => {
      if (t.isStringLiteral(child) && child.value.includes(text)) found = true;
    });
    return found;
  };

  return {
    name: 'secure-vault-auto-credit-debt',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        programPath.traverse({
          VariableDeclarator(path) {
            if (!t.isIdentifier(path.node.id, { name: 'emptyForm' }) || !t.isObjectExpression(path.node.init)) return;
            const exists = path.node.init.properties.some((property) =>
              t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'credit_balance' })
            );
            if (!exists) {
              path.node.init.properties.push(t.objectProperty(t.identifier('credit_balance'), t.stringLiteral('')));
            }
          },

          JSXElement(path) {
            const opening = path.node.openingElement;
            if (styleNameOf(opening) !== 'compactPanel' || !containsDebtPickerTitle(path.node)) return;

            const replacement = template.expression.ast(`
              <View style={styles.compactPanel}>
                <Text style={styles.compactPanelTitle}>الحد الائتماني</Text>
                <FormInput
                  label="الحد الائتماني (اختياري)"
                  value={String(form.credit_balance != null ? form.credit_balance : '')}
                  onChangeText={(value) => setField('credit_balance', String(value || '').replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
                <Text style={styles.securityHint}>الحد يُدخل من الخزنة الآمنة، وإذا كان أكبر من صفر تظهر البطاقة تلقائيًا في شاشة مديونية بطائق الائتمان.</Text>
              </View>
            `, { plugins: ['jsx'] });
            path.replaceWith(replacement);
            path.skip();
          },

          FunctionDeclaration(path) {
            if (!t.isIdentifier(path.node.id, { name: 'preparePayload' })) return;

            const statements = path.get('body.body');
            const payloadDeclaration = statements.find((statementPath) =>
              statementPath.isVariableDeclaration() && statementPath.node.declarations.some((declaration) =>
                t.isIdentifier(declaration.id, { name: 'payload' })
              )
            );

            if (payloadDeclaration) {
              const injected = template.statements.ast(`
                if (mode === 'card') {
                  const rawCreditBalance = payload.credit_balance;
                  const parsedCreditBalance = rawCreditBalance === '' || rawCreditBalance == null
                    ? 0
                    : Number(String(rawCreditBalance).replace(/,/g, ''));
                  if (!Number.isFinite(parsedCreditBalance) || parsedCreditBalance < 0) {
                    return { error: 'أدخل الحد الائتماني بصورة صحيحة.' };
                  }
                  payload.credit_balance = parsedCreditBalance;
                }
              `);
              payloadDeclaration.insertAfter(injected);
            }

            path.traverse({
              IfStatement(ifPath) {
                if (hasErrorMessage(ifPath.node.consequent, 'اربط البطاقة بسجلها في مديونية بطائق الائتمان')) {
                  ifPath.remove();
                }
              },
            });
          },
        });
      },
    },
  };
};
