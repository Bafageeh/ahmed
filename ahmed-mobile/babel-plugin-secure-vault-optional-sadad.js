module.exports = function secureVaultOptionalSadad({ types: t }) {
  return {
    name: 'secure-vault-optional-sadad',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        programPath.traverse({
          JSXAttribute(attributePath) {
            const node = attributePath.node;
            const opening = attributePath.parentPath && attributePath.parentPath.node;
            if (
              t.isJSXIdentifier(node.name, { name: 'label' }) &&
              t.isStringLiteral(node.value, { value: 'رقم سداد' }) &&
              t.isJSXOpeningElement(opening) &&
              t.isJSXIdentifier(opening.name, { name: 'FormInput' })
            ) {
              node.value = t.stringLiteral('رقم سداد (اختياري)');
            }
          },
          StringLiteral(stringPath) {
            if (stringPath.node.value === 'رقم البطاقة ورقم سداد يحفظان مشفرين. وسيتم تنبيهك في يوم الكشف.') {
              stringPath.node.value = 'رقم سداد اختياري لأن بعض البطاقات الائتمانية لا توفره. رقم البطاقة ورقم سداد يحفظان مشفرين، وسيتم تنبيهك في يوم الكشف.';
            }
          },
        });
      },
    },
  };
};
