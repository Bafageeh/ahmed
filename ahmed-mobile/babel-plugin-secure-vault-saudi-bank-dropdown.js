module.exports = function secureVaultSaudiBankDropdown({ types: t, template }) {
  const inNamedFunction = (path, name) => {
    const fn = path.findParent((parent) =>
      parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression()
    );
    if (!fn) return false;
    if (fn.isFunctionDeclaration()) return t.isIdentifier(fn.node.id, { name });
    const parent = fn.parentPath;
    return Boolean(parent && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name }));
  };

  const attrStringValue = (opening, name) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })
    );
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  return {
    name: 'secure-vault-saudi-bank-dropdown',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        const alreadyHasOptions = programPath.node.body.some((node) =>
          t.isVariableDeclaration(node) && node.declarations.some((decl) =>
            t.isVariableDeclarator(decl) && t.isIdentifier(decl.id, { name: 'SAUDI_BANK_OPTIONS' })
          )
        );

        if (!alreadyHasOptions) {
          const constants = template.statements.ast(`
            const SAUDI_BANK_OPTIONS = [
              { key: 'snb', name: 'البنك الأهلي السعودي' },
              { key: 'alrajhi', name: 'مصرف الراجحي' },
              { key: 'riyad', name: 'بنك الرياض' },
              { key: 'sab', name: 'البنك السعودي الأول' },
              { key: 'anb', name: 'البنك العربي الوطني' },
              { key: 'alinma', name: 'مصرف الإنماء' },
              { key: 'bsf', name: 'البنك السعودي الفرنسي' },
              { key: 'saib', name: 'البنك السعودي للاستثمار' },
              { key: 'aljazira', name: 'بنك الجزيرة' },
              { key: 'albilad', name: 'بنك البلاد' },
              { key: 'gib', name: 'بنك الخليج الدولي - السعودية' },
              { key: 'stc', name: 'STC Bank' },
              { key: 'vision', name: 'Vision Bank' },
              { key: 'd360', name: 'D360 Bank' },
            ];
          `);

          let insertIndex = 0;
          while (insertIndex < programPath.node.body.length && t.isImportDeclaration(programPath.node.body[insertIndex])) insertIndex += 1;
          programPath.node.body.splice(insertIndex, 0, ...constants);
        }

        const alreadyHasComponent = programPath.node.body.some((node) =>
          t.isFunctionDeclaration(node) && t.isIdentifier(node.id, { name: 'SaudiBankDropdown' })
        );

        if (!alreadyHasComponent) {
          const component = template.statement.ast(`
            function SaudiBankDropdown({ value, onChange }) {
              const [open, setOpen] = useState(false);
              const selected = SAUDI_BANK_OPTIONS.find((option) => normalizeText(option.name) === normalizeText(value)) || null;
              return <View style={{ marginBottom: 14, zIndex: 20 }}>
                <Text style={styles.inputLabel}>اسم البنك</Text>
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => setOpen((current) => !current)}
                  style={{
                    minHeight: 58,
                    borderWidth: 1,
                    borderColor: open ? '#94a3b8' : '#dbe3ee',
                    borderRadius: 18,
                    backgroundColor: '#ffffff',
                    paddingHorizontal: 14,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {selected ? <BankLogo bankName={selected.name} size={36} /> : <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20 }}>🏦</Text></View>}
                  <Text numberOfLines={1} style={{ flex: 1, color: selected ? '#0f172a' : '#94a3b8', fontSize: 16, fontWeight: '800', textAlign: 'right' }}>
                    {selected ? selected.name : 'اختر البنك'}
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 22, fontWeight: '800' }}>{open ? '⌃' : '⌄'}</Text>
                </TouchableOpacity>
                {open ? <View style={{ marginTop: 8, maxHeight: 300, borderWidth: 1, borderColor: '#dbe3ee', borderRadius: 18, backgroundColor: '#ffffff', overflow: 'hidden' }}>
                  <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {SAUDI_BANK_OPTIONS.map((option, index) => {
                      const active = selected?.key === option.key;
                      return <TouchableOpacity
                        key={option.key}
                        activeOpacity={0.76}
                        onPress={() => { onChange(option.name); setOpen(false); }}
                        style={{
                          minHeight: 58,
                          paddingHorizontal: 14,
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 12,
                          backgroundColor: active ? '#f0f9ff' : '#ffffff',
                          borderBottomWidth: index === SAUDI_BANK_OPTIONS.length - 1 ? 0 : 1,
                          borderBottomColor: '#eef2f7',
                        }}
                      >
                        <BankLogo bankName={option.name} size={36} />
                        <Text style={{ flex: 1, color: '#0f172a', fontSize: 15.5, fontWeight: active ? '900' : '700', textAlign: 'right' }}>{option.name}</Text>
                        {active ? <Text style={{ color: '#0284c7', fontSize: 18, fontWeight: '900' }}>✓</Text> : null}
                      </TouchableOpacity>;
                    })}
                  </ScrollView>
                </View> : null}
              </View>;
            }
          `, { plugins: ['jsx'] });
          programPath.pushContainer('body', component);
        }

        let patched = false;
        programPath.traverse({
          JSXElement(path) {
            if (patched || !inNamedFunction(path, 'VaultFormModal')) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'FormInput' })) return;
            if (attrStringValue(opening, 'label') !== 'اسم البنك') return;

            const replacement = template.expression.ast(`
              <SaudiBankDropdown
                value={form.title}
                onChange={(bankName) => setField('title', bankName)}
              />
            `, { plugins: ['jsx'] });
            path.replaceWith(replacement);
            patched = true;
            path.skip();
          },
        });
      },
    },
  };
};
