module.exports = function secureVaultSectionIcons({ types: t, template }) {
  return {
    name: 'secure-vault-section-icons',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        const iconNames = ['LogIn', 'Phone', 'Landmark', 'CreditCard'];
        const existingLucideImport = programPath.node.body.find(
          (node) => t.isImportDeclaration(node) && node.source.value === 'lucide-react-native'
        );

        if (existingLucideImport) {
          const existingNames = new Set(
            existingLucideImport.specifiers
              .filter((specifier) => t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported))
              .map((specifier) => specifier.imported.name)
          );
          iconNames.forEach((name) => {
            if (!existingNames.has(name)) {
              existingLucideImport.specifiers.push(
                t.importSpecifier(t.identifier(name), t.identifier(name))
              );
            }
          });
        } else {
          programPath.unshiftContainer(
            'body',
            t.importDeclaration(
              iconNames.map((name) => t.importSpecifier(t.identifier(name), t.identifier(name))),
              t.stringLiteral('lucide-react-native')
            )
          );
        }

        let patched = false;
        programPath.traverse({
          FunctionDeclaration(path) {
            if (patched || !t.isIdentifier(path.node.id, { name: 'SectionHeader' })) return;

            const body = template.statements.ast(`
              const Icon = title === 'بيانات الدخول'
                ? LogIn
                : title === 'الهاتف المصرفي'
                  ? Phone
                  : title === 'الحسابات البنكية'
                    ? Landmark
                    : title === 'البطاقات'
                      ? CreditCard
                      : null;

              return <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  {Icon ? <Icon size={25} strokeWidth={2.25} color="#245f91" /> : null}
                  <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                {action && onAction ? (
                  <TouchableOpacity style={styles.sectionAction} onPress={onAction}>
                    <Text style={styles.sectionActionText}>{action}</Text>
                  </TouchableOpacity>
                ) : <View />}
              </View>;
            `, { plugins: ['jsx'] });

            path.node.body.body = body;
            patched = true;
            path.skip();
          },
        });
      },
    },
  };
};
