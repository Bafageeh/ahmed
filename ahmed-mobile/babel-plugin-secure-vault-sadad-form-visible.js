module.exports = function secureVaultSadadFormVisible({ types: t, template }) {
  const labelOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return '';
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'label' })
    );
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : '';
  };

  const styleNameOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return '';
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return '';
    const expression = attr.value.expression;
    return t.isMemberExpression(expression) &&
      t.isIdentifier(expression.object, { name: 'styles' }) &&
      t.isIdentifier(expression.property)
      ? expression.property.name
      : '';
  };

  const inVaultForm = (path) => {
    const fn = path.findParent((parent) => parent.isFunctionDeclaration());
    return Boolean(fn && t.isIdentifier(fn.node.id, { name: 'VaultFormModal' }));
  };

  return {
    name: 'secure-vault-sadad-form-visible',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        const existingSadad = [];
        let anchorPath = null;

        programPath.traverse({
          JSXElement(path) {
            if (!inVaultForm(path)) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'FormInput' })) return;
            const label = labelOf(opening);

            if (label === 'CVV (اختياري)') anchorPath = path;
            else if (!anchorPath && label === 'رقم البطاقة (اختياري)') anchorPath = path;

            if (label.startsWith('رقم سداد')) existingSadad.push(path);
          },
        });

        existingSadad.forEach((sadadPath) => {
          if (!sadadPath || sadadPath.removed) return;
          const parent = sadadPath.parentPath;
          if (
            parent &&
            parent.isJSXElement() &&
            styleNameOf(parent.node.openingElement) === 'half'
          ) {
            parent.remove();
          } else {
            sadadPath.remove();
          }
        });

        if (!anchorPath || anchorPath.removed) return;

        const sadadField = template.expression.ast(`
          {form.card_type === 'credit' ? (
            <FormInput
              label="رقم سداد (اختياري)"
              value={String(form.sadad_number || '')}
              onChangeText={(value) => setField('sadad_number', String(value || '').replace(/\\D/g, ''))}
              keyboardType="number-pad"
              placeholder="رقم السداد"
            />
          ) : null}
        `, { plugins: ['jsx'] });

        anchorPath.insertAfter(sadadField);
      },
    },
  };
};
