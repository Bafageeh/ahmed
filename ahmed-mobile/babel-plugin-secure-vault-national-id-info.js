module.exports = function secureVaultNationalIdInfo({ types: t, template }) {
  const NATIONAL_ID_TAG = '__bank_username_national_id__';

  const inNamedFunction = (path, name) => {
    const fn = path.findParent((parent) => parent.isFunctionDeclaration());
    return Boolean(fn && t.isIdentifier(fn.node.id, { name }));
  };

  const jsxTextIncludes = (node, text) => {
    let found = false;
    const visit = (value) => {
      if (!value || found) return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (typeof value !== 'object') return;
      if (t.isJSXText(value) && String(value.value || '').includes(text)) {
        found = true;
        return;
      }
      Object.keys(value).forEach((key) => {
        if (key === 'loc' || key === 'start' || key === 'end') return;
        visit(value[key]);
      });
    };
    visit(node);
    return found;
  };

  const jsxLabel = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'label' })
    );
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  return {
    name: 'secure-vault-national-id-info',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let secretCardPatched = false;
        let togglePatched = false;
        let conditionalPatched = false;
        let payloadPatched = false;

        programPath.traverse({
          FunctionDeclaration(path) {
            if (t.isIdentifier(path.node.id, { name: 'SecretCard' }) && !secretCardPatched) {
              const body = template.statements.ast(`
                const usesNationalId = String(item.tags || '') === '${NATIONAL_ID_TAG}';
                const hasLogin = usesNationalId || item.has_username || item.has_password || item.username || item.password;
                if (!hasLogin) return <View style={styles.secretCard}><Text style={styles.noLogin}>لا توجد بيانات دخول محفوظة لهذا البنك.</Text></View>;
                const customerNumber = revealed ? (item.security_question || '—') : '••••••••';
                const usernameValue = usesNationalId
                  ? 'رقم الهوية'
                  : (revealed ? (item.username || '—') : (item.has_username ? '••••••••' : '—'));
                return <View style={styles.secretCard}>
                  <SecretRow label="رقم العميل" value={customerNumber} />
                  <SecretRow label="اسم المستخدم" value={usernameValue} />
                  <SecretRow label="كلمة المرور" value={revealed ? (item.password || '—') : (item.has_password ? '••••••••••' : '—')} />
                  <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity>
                </View>;
              `, { plugins: ['jsx'] });
              path.node.body.body = body;
              secretCardPatched = true;
              path.skip();
              return;
            }

            if (t.isIdentifier(path.node.id, { name: 'preparePayload' }) && !payloadPatched) {
              const bodyPaths = path.get('body.body');
              const payloadDeclaration = bodyPaths.find((statementPath) => {
                if (!statementPath.isVariableDeclaration()) return false;
                return statementPath.node.declarations.some((declaration) =>
                  t.isVariableDeclarator(declaration) && t.isIdentifier(declaration.id, { name: 'payload' })
                );
              });
              if (payloadDeclaration) {
                payloadDeclaration.insertAfter(template.statement.ast(`
                  if (mode === 'bankLogin' && String(payload.tags || '') === '${NATIONAL_ID_TAG}') {
                    payload.username = 'رقم الهوية';
                    payload.security_answer = '';
                  }
                `));
                payloadPatched = true;
              }
            }
          },

          JSXElement(path) {
            if (togglePatched || !inNamedFunction(path, 'VaultFormModal')) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'TouchableOpacity' })) return;
            if (!jsxTextIncludes(path.node, 'رقم الهوية')) return;

            const onPress = opening.attributes.find((item) =>
              t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'onPress' })
            );
            if (!onPress) return;

            onPress.value = t.jsxExpressionContainer(template.expression.ast(`
              () => {
                const enabled = String(form.tags || '') !== '${NATIONAL_ID_TAG}';
                if (enabled) {
                  setField('tags', '${NATIONAL_ID_TAG}');
                  setField('security_answer', '');
                  setField('username', 'رقم الهوية');
                } else {
                  setField('tags', '');
                  setField('security_answer', '');
                  setField('username', '');
                }
              }
            `));
            togglePatched = true;
          },

          ConditionalExpression(path) {
            if (conditionalPatched || !inNamedFunction(path, 'VaultFormModal')) return;
            const consequent = path.node.consequent;
            if (!t.isJSXElement(consequent)) return;
            if (!t.isJSXIdentifier(consequent.openingElement.name, { name: 'FormInput' })) return;
            if (jsxLabel(consequent.openingElement) !== 'رقم الهوية') return;

            path.node.consequent = template.expression.ast(`
              <Text style={styles.securityHint}>اسم المستخدم هو رقم الهوية</Text>
            `, { plugins: ['jsx'] });
            conditionalPatched = true;
          },
        });
      },
    },
  };
};
