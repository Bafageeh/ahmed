module.exports = function secureVaultPhoneBanking({ types: t, template }) {
  const PHONE_TAG = '__phone_banking__';
  const NATIONAL_ID_TAG = '__bank_username_national_id__';

  const inNamedFunction = (path, name) => {
    const fn = path.findParent((parent) =>
      parent.isFunctionDeclaration() || parent.isFunctionExpression() || parent.isArrowFunctionExpression()
    );
    if (!fn) return false;
    if (fn.isFunctionDeclaration()) return t.isIdentifier(fn.node.id, { name });
    const parent = fn.parentPath;
    return Boolean(parent && parent.isVariableDeclarator() && t.isIdentifier(parent.node.id, { name }));
  };

  const attrValue = (opening, name) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((item) =>
      t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })
    );
    if (!attr) return null;
    return t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  const isIdentifierTest = (path, name) => {
    const conditional = path.findParent((parent) => parent.isConditionalExpression());
    return Boolean(conditional && t.isIdentifier(conditional.node.test, { name }));
  };

  return {
    name: 'secure-vault-phone-banking',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let secretCardPatched = false;
        let bankDetailsPatched = false;
        let buildVaultPatched = false;
        let startPhoneInserted = false;
        let bankDetailsPropPatched = false;
        let bankCustomerInputRemoved = false;
        let modalFlagPatched = false;
        let modalTitlePatched = false;
        let phoneFormInserted = false;
        let payloadPatched = false;
        let helperExists = false;

        programPath.traverse({
          FunctionDeclaration(path) {
            const name = path.node.id && path.node.id.name;
            if (name === 'PhoneBankingCard') helperExists = true;

            if (name === 'SecretCard' && !secretCardPatched) {
              const body = template.statements.ast(`
                const hasLogin = item.has_username || item.has_password || item.username || item.password;
                if (!hasLogin) return <View style={styles.secretCard}><Text style={styles.noLogin}>لا توجد بيانات دخول محفوظة لهذا البنك.</Text></View>;
                const usesNationalId = String(item.tags || '') === '${NATIONAL_ID_TAG}';
                return <View style={styles.secretCard}>
                  <SecretRow
                    label={usesNationalId ? 'رقم الهوية' : 'اسم المستخدم'}
                    value={revealed ? (item.username || '—') : (item.has_username ? '••••••••' : '—')}
                  />
                  <SecretRow label="كلمة المرور" value={revealed ? (item.password || '—') : (item.has_password ? '••••••••••' : '—')} />
                  <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity>
                </View>;
              `, { plugins: ['jsx'] });
              path.node.body.body = body;
              secretCardPatched = true;
              path.skip();
              return;
            }

            if (name === 'BankDetails' && !bankDetailsPatched) {
              if (path.node.params.length && t.isObjectPattern(path.node.params[0])) {
                const params = path.node.params[0];
                const hasPhoneProp = params.properties.some((property) =>
                  t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'onPhoneBanking' })
                );
                if (!hasPhoneProp) {
                  params.properties.push(t.objectProperty(t.identifier('onPhoneBanking'), t.identifier('onPhoneBanking'), false, true));
                }
              }

              const body = template.statements.ast(`
                const [accountsOpen, setAccountsOpen] = useState(false);
                const bank = group.bank;
                const phoneBanking = group.phoneBanking || null;
                const hasCredentials = Boolean(bank && (bank.has_username || bank.has_password || bank.username || bank.password));
                return <>
                  <View style={styles.bankHero}><View style={styles.bankHeroLogo}><BankLogo bankName={group.displayName} size={62} /></View><View style={styles.bankHeroText}><Text style={styles.bankHeroName}>{cleanBankName(group.displayName)}</Text><Text style={styles.bankHeroSub}>حساب الدخول والبطاقات</Text></View>{bank ? <TouchableOpacity style={styles.editPill} onPress={() => onEdit(bank)}><Text style={styles.editPillText}>تعديل</Text></TouchableOpacity> : null}</View>
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
              return;
            }

            if (name === 'buildVault' && !buildVaultPatched) {
              const body = template.statements.ast(`
                const banks = items.filter((item) => getMode(item) === 'bank');
                const cards = items.filter((item) => getMode(item) === 'card');
                const logins = items.filter((item) => getMode(item) === 'login');
                const accounts = items.filter((item) => getMode(item) === 'account');
                const phoneBankingItems = items.filter((item) => String(item.tags || '') === '${PHONE_TAG}' && item.category === 'subscriptions' && item.record_type === 'subscription');
                const groups = banks.map((bank) => ({ key: bankRef(bank), bank, displayName: bank.title || 'بنك', cards: [], accounts: [], logins: [], phoneBanking: null }));
                const byKey = new Map(groups.map((group) => [group.key, group]));
                const findGroup = (item) => {
                  const owner = String(item.owner_group || '').trim();
                  if (owner && byKey.has(owner)) return byKey.get(owner);
                  const normalized = normalizeText(owner.replace(/^bank:/, ''));
                  return groups.find((group) => String(group.bank?.id) === owner.replace(/^bank:/, '') || normalizeText(group.displayName) === normalized || normalizeText(cleanBankName(group.displayName)) === normalizeText(cleanBankName(owner))) || null;
                };
                cards.forEach((item) => { const group = findGroup(item); if (group) group.cards.push(item); });
                accounts.forEach((item) => { const group = findGroup(item); if (group) group.accounts.push(item); });
                phoneBankingItems.forEach((item) => { const group = findGroup(item); if (group && !group.phoneBanking) group.phoneBanking = item; });
                const siteLogins = [];
                logins.forEach((item) => { const group = findGroup(item); if (group && item.owner_group !== SITE_GROUP) group.logins.push(item); else siteLogins.push(item); });
                groups.sort((a, b) => bankRank(a.displayName) - bankRank(b.displayName));
                return { groups, siteLogins };
              `);
              path.node.body.body = body;
              buildVaultPatched = true;
              path.skip();
              return;
            }

            if (name === 'preparePayload' && !payloadPatched) {
              const payloadDeclaration = path.get('body.body').find((statementPath) =>
                statementPath.isVariableDeclaration() && statementPath.node.declarations.some((declaration) =>
                  t.isVariableDeclarator(declaration) && t.isIdentifier(declaration.id, { name: 'payload' })
                )
              );
              if (payloadDeclaration) {
                payloadDeclaration.insertAfter(template.statement.ast(`
                  if (mode === 'phoneBanking') {
                    payload.category = 'subscriptions';
                    payload.record_type = 'subscription';
                    payload.owner_group = String(form.owner_group || payload.owner_group || '').trim();
                    payload.title = 'الهاتف المصرفي';
                    payload.tags = '${PHONE_TAG}';
                    payload.phone = digitsOnly(form.phone, 20);
                    payload.username = digitsOnly(form.username, 30);
                    payload.password = digitsOnly(form.password, 4);
                    payload.url = '';
                    payload.email = '';
                    payload.purpose = '';
                    payload.card_type = null;
                    payload.card_brand = null;
                    payload.statement_day = null;
                    payload.credit_card_debt_id = null;
                    payload.sadad_number = '';
                    if (!payload.owner_group) return { error: 'تعذر تحديد البنك.' };
                    if (!payload.phone) return { error: 'أدخل رقم الاتصال.' };
                    if (!payload.username) return { error: 'أدخل رقم العميل.' };
                    if (payload.password.length !== 4 || digitsOnly(payload.password, 4) !== payload.password) return { error: 'الرقم السري للهاتف المصرفي يجب أن يتكون من 4 أرقام.' };
                  }
                `));
                payloadPatched = true;
              }
            }
          },

          VariableDeclaration(path) {
            if (!inNamedFunction(path, 'SecureVaultScreen') || startPhoneInserted) return;
            const hasStartBankCredentials = path.node.declarations.some((declaration) =>
              t.isVariableDeclarator(declaration) && t.isIdentifier(declaration.id, { name: 'startBankCredentials' })
            );
            if (!hasStartBankCredentials) return;
            path.insertAfter(template.statement.ast(`
              const startPhoneBanking = async () => {
                if (!selectedGroup?.bank) return;
                const existing = selectedGroup.phoneBanking || null;
                let full = existing;
                if (existing?.id) {
                  try {
                    const response = await fetch(\`\${API_URL}/secure-vault/\${existing.id}\`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) });
                    const json = await response.json();
                    if (response.ok && json?.data) full = json.data;
                  } catch (error) {}
                }
                openForm('phoneBanking', {
                  owner_group: groupRef(selectedGroup),
                  category: 'subscriptions',
                  record_type: 'subscription',
                  title: 'الهاتف المصرفي',
                  phone: full?.phone || '',
                  username: full?.username || '',
                  password: full?.password || '',
                  tags: '${PHONE_TAG}',
                }, full?.id || null);
              };
            `));
            startPhoneInserted = true;
          },

          JSXOpeningElement(path) {
            if (bankDetailsPropPatched || !inNamedFunction(path, 'SecureVaultScreen')) return;
            if (!t.isJSXIdentifier(path.node.name, { name: 'BankDetails' })) return;
            const hasProp = path.node.attributes.some((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'onPhoneBanking' }));
            if (!hasProp) {
              path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('onPhoneBanking'), t.jsxExpressionContainer(t.identifier('startPhoneBanking'))));
            }
            bankDetailsPropPatched = true;
          },

          JSXElement(path) {
            if (bankCustomerInputRemoved || !inNamedFunction(path, 'VaultFormModal')) return;
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'FormInput' })) return;
            if (attrValue(opening, 'label') !== 'رقم العميل') return;
            if (!isIdentifierTest(path, 'isBankLogin')) return;
            path.remove();
            bankCustomerInputRemoved = true;
          },

          VariableDeclarator(path) {
            if (!inNamedFunction(path, 'VaultFormModal')) return;
            if (t.isIdentifier(path.node.id, { name: 'isBank' }) && !modalFlagPatched) {
              const declaration = path.parentPath;
              declaration.insertAfter(template.statement.ast(`const isPhoneBanking = formMode === 'phoneBanking';`));
              modalFlagPatched = true;
              return;
            }
            if (t.isIdentifier(path.node.id, { name: 'title' }) && !modalTitlePatched) {
              path.node.init = t.conditionalExpression(
                t.identifier('isPhoneBanking'),
                template.expression.ast(`editingId ? 'تعديل الهاتف المصرفي' : 'إضافة الهاتف المصرفي'`),
                path.node.init
              );
              modalTitlePatched = true;
            }
          },

          ConditionalExpression(path) {
            if (phoneFormInserted || !inNamedFunction(path, 'VaultFormModal')) return;
            if (!t.isIdentifier(path.node.test, { name: 'isBankLogin' })) return;
            const container = path.parentPath;
            if (!container || !container.isJSXExpressionContainer()) return;
            const phoneConditional = template.expression.ast(`
              isPhoneBanking ? <>
                {ownerGroup ? <View style={styles.fixedBankBox}><BankLogo bankName={ownerGroup.displayName} size={34} /><Text style={styles.fixedBankText}>{cleanBankName(ownerGroup.displayName)}</Text></View> : null}
                <FormInput label="رقم الاتصال" value={form.phone} onChangeText={(value) => setField('phone', digitsOnly(value, 20))} keyboardType="phone-pad" placeholder="رقم الهاتف المصرفي" />
                <FormInput label="رقم العميل" value={form.username} onChangeText={(value) => setField('username', digitsOnly(value, 30))} keyboardType="number-pad" />
                <FormInput label="الرقم السري" value={form.password} onChangeText={(value) => setField('password', digitsOnly(value, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} />
                <Text style={styles.securityHint}>الرقم السري يجب أن يكون 4 أرقام، ويُحفظ رقم العميل والرقم السري مشفرين.</Text>
              </> : null
            `, { plugins: ['jsx'] });
            container.insertAfter(t.jsxExpressionContainer(phoneConditional));
            phoneFormInserted = true;
          },
        });

        if (!helperExists) {
          programPath.pushContainer('body', template.statement.ast(`
            function PhoneBankingCard({ item, revealed, onReveal }) {
              const hasSecrets = item.has_username || item.has_password || item.username || item.password;
              return <View style={styles.secretCard}>
                <SecretRow label="رقم الاتصال" value={item.phone || '—'} />
                <SecretRow label="رقم العميل" value={revealed ? (item.username || '—') : (item.has_username ? '••••••••' : '—')} />
                <SecretRow label="الرقم السري" value={revealed ? (item.password || '—') : (item.has_password ? '••••' : '—')} />
                {hasSecrets ? <TouchableOpacity style={styles.revealButton} onPress={onReveal}><Text style={styles.revealText}>{revealed ? 'إخفاء' : 'فك التشفير'}</Text></TouchableOpacity> : null}
              </View>;
            }
          `, { plugins: ['jsx'] }));
        }
      },
    },
  };
};
