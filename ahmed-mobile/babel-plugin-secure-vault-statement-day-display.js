'use strict';

module.exports = function secureVaultStatementDayDisplay({ types: t, template }) {
  const getAttr = (opening, name) => opening.attributes.find((item) =>
    t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name })
  );

  const attrString = (opening, name) => {
    const attr = getAttr(opening, name);
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  return {
    name: 'secure-vault-statement-day-display',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        let loadItemsPatched = false;
        let displayPatched = 0;

        programPath.traverse({
          VariableDeclarator(path) {
            if (!t.isIdentifier(path.node.id, { name: 'loadItems' })) return;
            if (!t.isArrowFunctionExpression(path.node.init)) return;

            path.node.init = template.expression.ast(`
              async () => {
                setLoading(true); setMessage('');
                try {
                  const [vaultResponse, debtsResponse] = await Promise.all([
                    fetch(\`${'${API_URL}'}/secure-vault\`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) }),
                    fetch(\`${'${API_URL}'}/credit-card-debts\`, { headers: ahmedUserHeaders({ Accept: 'application/json' }) }),
                  ]);
                  const vaultJson = await vaultResponse.json();
                  const debtsJson = await debtsResponse.json();
                  if (!vaultResponse.ok) throw new Error(vaultJson.message || 'load failed');

                  const rawLoaded = Array.isArray(vaultJson.data) ? vaultJson.data : [];
                  let schedules = [];
                  try {
                    const scheduleResponse = await fetch(\`${'${API_URL}'}/bank-statement-schedules/mine\`, {
                      headers: ahmedUserHeaders({ Accept: 'application/json' }),
                    });
                    const scheduleJson = await scheduleResponse.json();
                    if (scheduleResponse.ok && Array.isArray(scheduleJson.data)) schedules = scheduleJson.data;
                  } catch (scheduleError) {}

                  const normalizeBankName = (value) => String(value || '')
                    .toLowerCase()
                    .replace(/[أإآ]/g, 'ا')
                    .replace(/ى/g, 'ي')
                    .replace(/ة/g, 'ه')
                    .replace(/ـ/g, '')
                    .replace(/[\\u064B-\\u065F\\u0670]/g, '')
                    .replace(/[^a-z0-9\\u0600-\\u06ff]+/g, '');

                  const loaded = rawLoaded.map((item) => {
                    if (getMode(item) !== 'card') return item;
                    const bankId = String(item.owner_group || '').replace(/\\D/g, '');
                    const bank = rawLoaded.find((entry) => String(entry.id) === bankId && entry.category === 'banks');
                    const bankName = normalizeBankName(bank?.title || '');
                    const schedule = schedules.find((entry) => {
                      const scheduleName = normalizeBankName(entry.bank_name || '');
                      return bankName && scheduleName && (
                        bankName === scheduleName ||
                        bankName.includes(scheduleName) ||
                        scheduleName.includes(bankName)
                      );
                    });
                    const day = Number(schedule?.statement_day || 0);
                    return {
                      ...item,
                      bank_statement_day: Number.isInteger(day) && day >= 1 && day <= 31 ? day : null,
                    };
                  });

                  setItems(loaded);
                  setCreditDebts(debtsResponse.ok && Array.isArray(debtsJson.data) ? debtsJson.data : []);
                  syncCardReminders(loaded);
                } catch (error) {
                  setMessage('تعذر تحميل الخزنة. تأكد من الاتصال بالخادم.');
                } finally { setLoading(false); }
              }
            `);

            loadItemsPatched = true;
            path.skip();
          },

          JSXElement(path) {
            const opening = path.node.openingElement;
            if (!t.isJSXIdentifier(opening.name)) return;

            const componentName = opening.name.name;
            const label = attrString(opening, 'label');

            if ((componentName === 'Spec' && label === 'تاريخ الكشف') || (componentName === 'MiniInfo' && label === 'الكشف')) {
              const valueAttr = getAttr(opening, 'value');
              const expression = template.expression.ast("item.bank_statement_day ? `يوم ${item.bank_statement_day}` : '—'");
              if (valueAttr) valueAttr.value = t.jsxExpressionContainer(expression);
              else opening.attributes.push(t.jsxAttribute(t.jsxIdentifier('value'), t.jsxExpressionContainer(expression)));
              displayPatched += 1;
            }

            if (componentName === 'FormInput' && label && label.includes('تاريخ الكشف')) {
              path.replaceWith(t.nullLiteral());
              path.skip();
            }
          },
        });

        if (!loadItemsPatched) {
          throw programPath.buildCodeFrameError('تعذر ربط يوم الكشف بجدول البنك داخل الخزنة الآمنة.');
        }
        if (!displayPatched) {
          throw programPath.buildCodeFrameError('تعذر إظهار يوم الكشف الفعلي على بطاقة الخزنة.');
        }
      },
    },
  };
};
