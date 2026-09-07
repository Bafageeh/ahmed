module.exports = function secureVaultBankDetailHeader({ types: t, template }) {
  const inNamedFunction = (path, name) => {
    const fn = path.findParent((parent) =>
      parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression()
    );
    if (!fn) return false;
    if (fn.isFunctionDeclaration()) return t.isIdentifier(fn.node.id, { name });
    const parent = fn.parentPath;
    return Boolean(parent && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name }));
  };

  const styleMemberName = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return null;
    const expression = attr.value.expression;
    if (!t.isMemberExpression(expression)) return null;
    if (!t.isIdentifier(expression.object, { name: 'styles' })) return null;
    return t.isIdentifier(expression.property) ? expression.property.name : null;
  };

  const hasPhoneBankingParam = (fnPath) => {
    if (!fnPath.node.params.length || !t.isObjectPattern(fnPath.node.params[0])) return false;
    return fnPath.node.params[0].properties.some((property) =>
      t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'onPhoneBanking' })
    );
  };

  return {
    name: 'secure-vault-bank-detail-header',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let banksViewPatched = false;
        let bankDetailsPatched = false;
        let topBarPatched = false;
        let floatingMenuPatched = false;
        let dropdownPatched = false;
        let messagePatched = false;

        programPath.traverse({
          FunctionDeclaration(path) {
            const name = path.node.id && path.node.id.name;

            if (name === 'BanksView' && !banksViewPatched) {
              const body = template.statements.ast(`
                return <>
                  {groups.length ? (
                    <View style={styles.bankGrid}>
                      {groups.map((group) => (
                        <TouchableOpacity key={group.key} style={styles.bankTile} activeOpacity={0.84} onPress={() => onBank(group)}>
                          <View style={styles.bankLogoBox}><BankLogo bankName={group.displayName} size={66} /></View>
                          <Text style={styles.bankTileName}>{cleanBankName(group.displayName)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : <EmptyCard text="لا توجد بنوك محفوظة." />}
                </>;
              `, { plugins: ['jsx'] });
              path.node.body.body = body;
              banksViewPatched = true;
              path.skip();
              return;
            }

            if (name === 'BankDetails' && !bankDetailsPatched) {
              if (path.node.params.length && t.isObjectPattern(path.node.params[0]) && !hasPhoneBankingParam(path)) {
                path.node.params[0].properties.push(
                  t.objectProperty(t.identifier('onPhoneBanking'), t.identifier('onPhoneBanking'), false, true)
                );
              }

              const body = template.statements.ast(`
                const [accountsOpen, setAccountsOpen] = useState(false);
                const bank = group.bank;
                const phoneBanking = group.phoneBanking || null;
                const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password));
                return <>
                  <SectionHeader title="بيانات الدخول" action={bank ? (hasCredentials ? 'تعديل' : 'إضافة') : ''} onAction={bank ? onEditCredentials : undefined} />
                  {bank ? <SecretCard item={bank} revealed={revealedId === bank.id} onReveal={() => onReveal(bank)} /> : <EmptyCard text="لا يوجد سجل أساسي لهذا البنك." />}
                  <SectionHeader title="الهاتف المصرفي" action={bank ? (phoneBanking ? 'تعديل' : 'إضافة') : ''} onAction={bank ? onPhoneBanking : undefined} />
                  {phoneBanking ? <PhoneBankingCard item={phoneBanking} revealed={revealedId === phoneBanking.id} onReveal={() => onReveal(phoneBanking)} /> : <EmptyCard text="لا توجد بيانات هاتف مصرفي محفوظة لهذا البنك." />}
                  <BankAccountsDropdown accounts={group.accounts} open={accountsOpen} onToggle={() => setAccountsOpen((value) => !value)} onAddAccount={onAddAccount} onEdit={onEdit} onDelete={onDelete} />
                  <SectionHeader title="البطاقات" action="إضافة بطاقة" onAction={onAddCard} />
                  {group.cards.length ? group.cards.map((card) => <BankCard key={card.id} item={card} creditDebts={creditDebts} revealed={revealedId === card.id} onReveal={() => onReveal(card)} onEdit={() => onEdit(card)} onDelete={() => onDelete(card)} />) : <EmptyCard text="لا توجد بطاقات محفوظة لهذا البنك." />}
                  {bank ? <TouchableOpacity style={styles.deleteBankButton} onPress={() => onDelete(bank)}><Text style={styles.deleteBankText}>حذف البنك</Text></TouchableOpacity> : null}
                </>;
              `, { plugins: ['jsx'] });

              path.node.body.body = body;
              bankDetailsPatched = true;
              path.skip();
            }
          },

          JSXElement(path) {
            if (!inNamedFunction(path, 'SecureVaultScreen')) return;
            const opening = path.node.openingElement;
            const styleName = styleMemberName(opening);

            if (!topBarPatched && t.isJSXIdentifier(opening.name, { name: 'View' }) && styleName === 'topBar') {
              const replacement = template.expression.ast(`
                <>
                  {view === 'bank' && selectedGroup ? (
                    <View style={[styles.topBar, { height: 94, paddingHorizontal: 84, paddingVertical: 8 }]}> 
                      <TouchableOpacity
                        onPress={goBack}
                        activeOpacity={0.72}
                        accessibilityLabel="رجوع"
                        style={{
                          position: 'absolute',
                          left: 16,
                          top: 15,
                          width: 54,
                          height: 54,
                          borderRadius: 18,
                          backgroundColor: '#f8fafc',
                          borderWidth: 1,
                          borderColor: '#dbe3ee',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#0f172a', fontSize: 40, lineHeight: 42, fontWeight: '500', marginTop: -3 }}>‹</Text>
                      </TouchableOpacity>
                      <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <BankLogo bankName={selectedGroup.displayName} size={46} />
                          <Text numberOfLines={1} style={{ color: '#0f172a', fontSize: 24, fontWeight: '900', textAlign: 'center', maxWidth: 190 }}>
                            {cleanBankName(selectedGroup.displayName)}
                          </Text>
                        </View>
                        <Text numberOfLines={1} style={{ color: '#94a3b8', fontSize: 12.5, fontWeight: '700', textAlign: 'center', marginTop: 2 }}>
                          حساب الدخول والبطاقات
                        </Text>
                      </View>
                    </View>
                  ) : view === 'banks' ? (
                    <View style={styles.topBar}>
                      <TouchableOpacity
                        onPress={goBack}
                        activeOpacity={0.72}
                        accessibilityLabel="رجوع"
                        style={{
                          position: 'absolute',
                          left: 16,
                          top: 11,
                          width: 50,
                          height: 50,
                          borderRadius: 17,
                          backgroundColor: '#f8fafc',
                          borderWidth: 1,
                          borderColor: '#dbe3ee',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#0f172a', fontSize: 38, lineHeight: 40, fontWeight: '500', marginTop: -3 }}>‹</Text>
                      </TouchableOpacity>
                      <Text style={styles.topTitle}>البنوك</Text>
                    </View>
                  ) : (
                    <View style={styles.topBar}>
                      <TouchableOpacity style={styles.topBackButton} onPress={goBack}><Text style={styles.topBackText}>رجوع</Text></TouchableOpacity>
                      <Text style={styles.topTitle}>الخزنة الآمنة</Text>
                      <TouchableOpacity style={styles.searchButton} onPress={() => setSearchOpen((value) => !value)}><Text style={styles.searchIcon}>🔍</Text></TouchableOpacity>
                    </View>
                  )}
                </>
              `, { plugins: ['jsx'] });
              path.replaceWith(replacement);
              topBarPatched = true;
              path.skip();
              return;
            }

            if (!floatingMenuPatched && t.isJSXIdentifier(opening.name, { name: 'TouchableOpacity' }) && styleName === 'floatingMenuButton') {
              const original = t.cloneNode(path.node, true);
              const allowed = t.logicalExpression(
                '&&',
                t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('bank')),
                t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('banks'))
              );
              path.replaceWith(t.jsxExpressionContainer(t.conditionalExpression(allowed, original, t.nullLiteral())));
              floatingMenuPatched = true;
              path.skip();
            }
          },

          ConditionalExpression(path) {
            if (!inNamedFunction(path, 'SecureVaultScreen')) return;

            if (!dropdownPatched && t.isIdentifier(path.node.test, { name: 'menuOpen' })) {
              const consequent = path.node.consequent;
              if (t.isJSXElement(consequent) && styleMemberName(consequent.openingElement) === 'dropdownMenu') {
                const allowed = t.logicalExpression(
                  '&&',
                  t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('bank')),
                  t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('banks'))
                );
                path.node.test = t.logicalExpression('&&', allowed, t.identifier('menuOpen'));
                dropdownPatched = true;
              }
            }

            if (!messagePatched) {
              const consequent = path.node.consequent;
              if (t.isJSXElement(consequent) && styleMemberName(consequent.openingElement) === 'message') {
                const allowed = t.logicalExpression(
                  '&&',
                  t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('bank')),
                  t.binaryExpression('!==', t.identifier('view'), t.stringLiteral('banks'))
                );
                path.node.test = t.logicalExpression('&&', allowed, path.node.test);
                messagePatched = true;
              }
            }
          },
        });
      },
    },
  };
};
