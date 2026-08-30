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

  const styleNameOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return null;
    const expression = attr.value.expression;
    return t.isMemberExpression(expression) &&
      t.isIdentifier(expression.object, { name: 'styles' }) &&
      t.isIdentifier(expression.property)
      ? expression.property.name
      : null;
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

        let hydratedInserted = false;
        let cvvFormInserted = false;
        let cvvSpecInserted = false;

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

            if (t.isIdentifier(path.node.id, { name: 'hasRevealable' }) && inFunction(path, 'BankCard')) {
              path.node.init = template.expression.ast(
                `item.has_card_number || item.card_last_four || item.has_card_cvv || (credit && item.has_sadad_number)`
              );
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
              return;
            }

            if (styleNameOf(opening) === 'specGrid' && inFunction(path, 'BankCard') && !cvvSpecInserted) {
              const cvvSpec = template.expression.ast(`
                <Spec label="CVV" value={revealed ? (item.card_cvv || '—') : (item.has_card_cvv ? '•••' : '—')} />
              `, { plugins: ['jsx'] });
              path.node.children.push(cvvSpec);
              cvvSpecInserted = true;
            }
          },

          JSXOpeningElement(path) {
            if (!t.isJSXIdentifier(path.node.name, { name: 'Spec' })) return;
            if (attrValue(path.node, 'label') !== 'رقم سداد') return;
            const valueAttr = path.node.attributes.find((attribute) =>
              t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'value' })
            );
            if (valueAttr) {
              valueAttr.value = t.jsxExpressionContainer(
                t.logicalExpression(
                  '||',
                  t.memberExpression(t.identifier('item'), t.identifier('sadad_number')),
                  t.stringLiteral('—')
                )
              );
            }
          },
        });
      },
    },
  };
};
