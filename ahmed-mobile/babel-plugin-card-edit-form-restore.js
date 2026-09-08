'use strict';

module.exports = function cardEditFormRestore({ types: t, template }) {
  const labelOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'label' })
    );
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  return {
    name: 'card-edit-form-restore',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let restored = false;

        programPath.traverse({
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

                {form.card_type === 'credit' ? (
                  <FormInput
                    label="اسم البطاقة"
                    value={form.title}
                    onChangeText={(value) => setField('title', value)}
                    placeholder="مثال: أجواء إنفينيت"
                  />
                ) : null}

                <View style={styles.compactChoiceRow}>
                  <View style={styles.compactChoiceBlock}>
                    <Text style={styles.inputLabel}>نوع البطاقة</Text>
                    <SegmentedRow
                      options={[{ value: 'mada', label: 'مدى' }, { value: 'credit', label: 'ائتمانية' }]}
                      value={form.card_type}
                      onChange={(value) => {
                        setField('card_type', value);
                        if (value === 'mada') {
                          setField('card_brand', 'mada');
                          setField('credit_card_debt_id', '');
                          setField('sadad_number', '');
                        } else if (form.card_brand === 'mada') {
                          setField('card_brand', 'visa');
                        }
                      }}
                    />
                  </View>
                  {form.card_type === 'credit' ? (
                    <View style={styles.compactChoiceBlock}>
                      <Text style={styles.inputLabel}>الشبكة</Text>
                      <SegmentedRow
                        options={[{ value: 'visa', label: 'Visa' }, { value: 'mastercard', label: 'Mastercard' }]}
                        value={form.card_brand}
                        onChange={(value) => setField('card_brand', value)}
                      />
                    </View>
                  ) : null}
                </View>

                {form.card_type === 'credit' ? (
                  <View style={styles.compactPanel}>
                    <Text style={styles.compactPanelTitle}>الحد الائتماني من شاشة المديونية</Text>
                    {debtOptions.length ? (
                      <PickerRow
                        options={debtOptions.map((debt) => ({
                          value: String(debt.id),
                          label: \`${'${debt.card_name || \'بطاقة\'}'} • ${'${money(debt.credit_limit)}'}\`,
                        }))}
                        value={String(form.credit_card_debt_id || '')}
                        onChange={(value) => setField('credit_card_debt_id', value)}
                      />
                    ) : (
                      <Text style={styles.securityHint}>لا توجد بطاقة في شاشة مديونية بطائق الائتمان لربط الحد.</Text>
                    )}
                    {selectedDebt ? (
                      <View style={styles.readOnlyBox}>
                        <Text style={styles.readOnlyLabel}>الحد الائتماني</Text>
                        <Text style={styles.readOnlyValue}>{money(selectedDebt.credit_limit)}</Text>
                      </View>
                    ) : null}
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
        });

        if (!restored) {
          throw programPath.buildCodeFrameError('تعذر استعادة حقول تعديل البطاقة بعد تطبيق جدول مواعيد الكشف.');
        }
      },
    },
  };
};
