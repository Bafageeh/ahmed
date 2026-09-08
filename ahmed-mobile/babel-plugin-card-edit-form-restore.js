'use strict';

module.exports = function cardEditFormRestore({ types: t, template }) {
  const labelOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'label' })
    );
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  const styleNameOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return null;
    const expr = attr.value.expression;
    return t.isMemberExpression(expr) && t.isIdentifier(expr.object, { name: 'styles' }) && t.isIdentifier(expr.property)
      ? expr.property.name
      : null;
  };

  const setExpressionAttr = (opening, name, expression) => {
    const existing = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })
    );
    const value = t.jsxExpressionContainer(expression);
    if (existing) existing.value = value;
    else opening.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), value));
  };

  const objectHasKey = (node, name) => node.properties.some((property) =>
    t.isObjectProperty(property) && (
      (t.isIdentifier(property.key) && property.key.name === name) ||
      (t.isStringLiteral(property.key) && property.key.value === name)
    )
  );

  return {
    name: 'card-edit-form-restore',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let restored = false;
        let editBalancePatched = false;

        programPath.traverse({
          VariableDeclarator(path) {
            if (!t.isIdentifier(path.node.id, { name: 'startEdit' }) || !t.isArrowFunctionExpression(path.node.init)) return;

            path.traverse({
              ObjectExpression(innerPath) {
                if (!objectHasKey(innerPath.node, 'card_type') || !objectHasKey(innerPath.node, 'credit_card_debt_id')) return;
                if (!objectHasKey(innerPath.node, 'credit_balance')) {
                  innerPath.node.properties.push(
                    t.objectProperty(
                      t.identifier('credit_balance'),
                      template.expression.ast("full.credit_balance != null ? String(full.credit_balance) : ''")
                    )
                  );
                }
                editBalancePatched = true;
                innerPath.stop();
              },
            });
          },

          ConditionalExpression(path) {
            if (restored || !t.isIdentifier(path.node.test, { name: 'isCard' })) return;
            if (!t.isJSXElement(path.node.consequent)) return;

            const opening = path.node.consequent.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'FormInput' })) return;
            const label = labelOf(opening);
            if (!label || !label.startsWith('رقم سداد')) return;

            path.node.consequent = template.expression.ast(`
              <View style={styles.cardFormCompact}>
                {ownerGroup ? (
                  <View style={[styles.fixedBankBox, styles.fixedBankBoxCompact]}>
                    <BankLogo bankName={ownerGroup.displayName} size={32} />
                    <Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text>
                  </View>
                ) : null}

                <FormInput
                  label="اسم البطاقة"
                  value={form.title}
                  onChangeText={(value) => setField('title', value)}
                  placeholder="مثال: أجواء إنفينيت"
                />

                <View>
                  <Text style={styles.inputLabel}>نوع البطاقة</Text>
                  <SegmentedRow
                    options={[
                      { value: 'mada', label: 'مدى' },
                      { value: 'visa', label: 'Visa' },
                      { value: 'mastercard', label: 'Mastercard' },
                    ]}
                    value={form.card_type === 'mada' ? 'mada' : (form.card_brand || 'visa')}
                    onChange={(value) => {
                      if (value === 'mada') {
                        setField('card_type', 'mada');
                        setField('card_brand', 'mada');
                        setField('credit_balance', '');
                        setField('credit_card_debt_id', '');
                        setField('sadad_number', '');
                      } else {
                        setField('card_type', 'credit');
                        setField('card_brand', value);
                      }
                    }}
                  />
                </View>

                {form.card_type === 'credit' ? (
                  <View style={styles.compactPanel}>
                    <Text style={styles.compactPanelTitle}>الحد الائتماني</Text>
                    <FormInput
                      label="الحد الائتماني (اختياري)"
                      value={String(form.credit_balance != null ? form.credit_balance : '')}
                      onChangeText={(value) => setField('credit_balance', String(value || '').replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                    <Text style={styles.securityHint}>الحد يُحفظ في بطاقة الخزنة الآمنة. إذا كان أكبر من صفر ستظهر البطاقة تلقائيًا في شاشة مديونية بطائق الائتمان.</Text>
                  </View>
                ) : null}

                <FormInput
                  label="رقم البطاقة (اختياري)"
                  value={form.card_number}
                  onChangeText={(value) => setField('card_number', digitsOnly(value, 19))}
                  keyboardType="number-pad"
                />

                {form.card_type === 'credit' ? (
                  <FormInput
                    label="CVV (اختياري)"
                    value={String(form.card_cvv || '')}
                    onChangeText={(value) => setField('card_cvv', digitsOnly(value, 4))}
                    keyboardType="number-pad"
                    placeholder="CVV"
                  />
                ) : null}

                <View style={styles.twoColumns}>
                  <View style={styles.half}>
                    <FormInput
                      label="سنة الانتهاء"
                      value={String(form.expiry_year || '')}
                      onChangeText={(value) => setField('expiry_year', digitsOnly(value, 4))}
                      keyboardType="number-pad"
                      placeholder="YYYY"
                    />
                  </View>
                  <View style={styles.half}>
                    <FormInput
                      label="شهر الانتهاء"
                      value={String(form.expiry_month || '')}
                      onChangeText={(value) => setField('expiry_month', digitsOnly(value, 2))}
                      keyboardType="number-pad"
                      placeholder="MM"
                    />
                  </View>
                </View>

                {form.card_type === 'credit' ? (
                  <FormInput
                    label="رقم سداد (اختياري)"
                    value={form.sadad_number}
                    onChangeText={(value) => setField('sadad_number', value)}
                    keyboardType="number-pad"
                  />
                ) : null}

                <Text style={styles.securityHint}>موعد كشف الحساب يطبق تلقائيًا حسب جدول البنك ولا يتم تعديله من البطاقة.</Text>

                <FormInput
                  label="ملاحظة"
                  value={form.notes}
                  onChangeText={(value) => setField('notes', value)}
                  multiline
                />
              </View>
            `, { plugins: ['jsx'] });

            restored = true;
            path.skip();
          },

          JSXElement(path) {
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name)) return;

            if (opening.name.name === 'Spec' && labelOf(opening) === 'نوع البطاقة') {
              setExpressionAttr(opening, 'value', t.identifier('brand'));
            }

            if (opening.name.name === 'Spec' && labelOf(opening) === 'الحد الائتماني') {
              setExpressionAttr(
                opening,
                'value',
                template.expression.ast("credit && Number(item.credit_balance || 0) > 0 ? money(item.credit_balance) : '—'")
              );
            }

            if (opening.name.name === 'Text' && styleNameOf(opening) === 'cardBrand') {
              path.node.children = [t.jsxExpressionContainer(t.identifier('brand'))];
            }
          },
        });

        if (!restored) {
          throw programPath.buildCodeFrameError('تعذر استعادة حقول تعديل البطاقة بعد تطبيق جدول مواعيد الكشف.');
        }
        if (!editBalancePatched) {
          throw programPath.buildCodeFrameError('تعذر تحميل الحد الائتماني من بطاقة الخزنة عند التعديل.');
        }
      },
    },
  };
};
