'use strict';

module.exports = function bankStatementSchedulesPlugin({ types: t }) {
  const getAttr = (opening, name) => opening.attributes.find((item) => t.isJSXAttribute(item) && t.isJSXIdentifier(item.name, { name }));
  const attrString = (opening, name) => {
    const attr = getAttr(opening, name);
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };
  const styleIs = (opening, styleName) => {
    const attr = getAttr(opening, 'style');
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return false;
    const expr = attr.value.expression;
    return t.isMemberExpression(expr) && t.isIdentifier(expr.object, { name: 'styles' }) && t.isIdentifier(expr.property, { name: styleName });
  };
  const containsString = (node, value) => {
    let found = false;
    t.traverseFast(node, (child) => {
      if (t.isStringLiteral(child) && child.value.includes(value)) found = true;
    });
    return found;
  };
  const isModeCardTest = (node) => {
    if (!t.isBinaryExpression(node) || !['===', '=='].includes(node.operator)) return false;
    return (
      (t.isIdentifier(node.left, { name: 'mode' }) && t.isStringLiteral(node.right, { value: 'card' })) ||
      (t.isIdentifier(node.right, { name: 'mode' }) && t.isStringLiteral(node.left, { value: 'card' }))
    );
  };
  const findFormInput = (node, label) => {
    let match = null;
    t.traverseFast(node, (child) => {
      if (match || !t.isJSXElement(child) || !t.isJSXIdentifier(child.openingElement.name, { name: 'FormInput' })) return;
      if (attrString(child.openingElement, 'label') === label) match = child;
    });
    return match;
  };

  return {
    name: 'bank-statement-schedules',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');

        if (filename.endsWith('AppShell.js')) {
          const body = programPath.node.body;
          const hasScreenImport = body.some((node) => t.isImportDeclaration(node) && node.source.value === './BankStatementSchedulesScreen');
          const hasSyncImport = body.some((node) => t.isImportDeclaration(node) && node.source.value === './BankStatementReminderSync');
          if (!hasScreenImport) body.unshift(t.importDeclaration([t.importDefaultSpecifier(t.identifier('BankStatementSchedulesScreen'))], t.stringLiteral('./BankStatementSchedulesScreen')));
          if (!hasSyncImport) body.unshift(t.importDeclaration([t.importSpecifier(t.identifier('syncBankStatementReminders'), t.identifier('syncBankStatementReminders'))], t.stringLiteral('./BankStatementReminderSync')));

          let fullScreenPatched = false;
          let appShellEffectPatched = false;
          let renderRoutePatched = false;
          let settingsMenuPatched = false;

          programPath.traverse({
            VariableDeclarator(path) {
              if (t.isIdentifier(path.node.id, { name: 'fullScreenTabs' }) && t.isArrayExpression(path.node.init)) {
                const exists = path.node.init.elements.some((item) => t.isStringLiteral(item, { value: 'bankStatementSchedules' }));
                if (!exists) path.node.init.elements.push(t.stringLiteral('bankStatementSchedules'));
                fullScreenPatched = true;
              }

              if (t.isIdentifier(path.node.id, { name: 'renderScreen' }) && t.isArrowFunctionExpression(path.node.init) && t.isBlockStatement(path.node.init.body)) {
                const exists = path.node.init.body.body.some((statement) => containsString(statement, 'bankStatementSchedules'));
                if (!exists) {
                  const condition = t.ifStatement(
                    t.binaryExpression('===', t.identifier('activeTab'), t.stringLiteral('bankStatementSchedules')),
                    t.returnStatement(
                      t.jsxElement(
                        t.jsxOpeningElement(t.jsxIdentifier('BankStatementSchedulesScreen'), [
                          t.jsxAttribute(t.jsxIdentifier('onBack'), t.jsxExpressionContainer(t.arrowFunctionExpression([], t.callExpression(t.identifier('openTab'), [t.stringLiteral('more')])))),
                        ], true),
                        null,
                        [],
                        true
                      )
                    )
                  );
                  path.node.init.body.body.unshift(condition);
                }
                renderRoutePatched = true;
              }
            },

            FunctionDeclaration(path) {
              if (t.isIdentifier(path.node.id, { name: 'AppShell' })) {
                const already = path.node.body.body.some((statement) => containsString(statement, 'syncBankStatementReminders'));
                if (!already) {
                  const effect = t.expressionStatement(t.callExpression(t.identifier('useEffect'), [
                    t.arrowFunctionExpression([], t.blockStatement([
                      t.expressionStatement(t.callExpression(t.identifier('syncBankStatementReminders'), [])),
                    ])),
                    t.arrayExpression([t.optionalMemberExpression(t.identifier('currentUser'), t.identifier('id'), false, true)]),
                  ]));
                  path.node.body.body.unshift(effect);
                }
                appShellEffectPatched = true;
              }

              if (t.isIdentifier(path.node.id, { name: 'MoreScreen' })) {
                path.traverse({
                  JSXElement(innerPath) {
                    const opening = innerPath.node.openingElement;
                    if (!t.isJSXIdentifier(opening.name, { name: 'View' }) || !styleIs(opening, 'menu')) return;
                    const exists = innerPath.node.children.some((child) => containsString(child, 'bankStatementSchedules'));
                    if (!exists) {
                      const row = t.jsxElement(
                        t.jsxOpeningElement(t.jsxIdentifier('MenuRow'), [
                          t.jsxAttribute(t.jsxIdentifier('title'), t.stringLiteral('مواعيد كشف البطاقات')),
                          t.jsxAttribute(t.jsxIdentifier('text'), t.stringLiteral('تحديد يوم الكشف لكل بنك لجميع المستخدمين')),
                          t.jsxAttribute(t.jsxIdentifier('icon'), t.stringLiteral('payments')),
                          t.jsxAttribute(t.jsxIdentifier('onPress'), t.jsxExpressionContainer(t.arrowFunctionExpression([], t.callExpression(t.identifier('goTo'), [t.stringLiteral('bankStatementSchedules')])))),
                        ], true),
                        null,
                        [],
                        true
                      );
                      innerPath.node.children.unshift(
                        t.jsxExpressionContainer(t.conditionalExpression(t.identifier('isAdmin'), row, t.nullLiteral()))
                      );
                    }
                    settingsMenuPatched = true;
                    innerPath.stop();
                  },
                });
              }
            },
          });

          if (!fullScreenPatched) throw programPath.buildCodeFrameError('تعذر إضافة شاشة جدول كشف البنوك إلى fullScreenTabs.');
          if (!appShellEffectPatched) throw programPath.buildCodeFrameError('تعذر تشغيل مزامنة تنبيهات كشف البنوك عند فتح التطبيق.');
          if (!renderRoutePatched) throw programPath.buildCodeFrameError('تعذر إضافة مسار شاشة مواعيد الكشف.');
          if (!settingsMenuPatched) throw programPath.buildCodeFrameError('تعذر إضافة زر مواعيد الكشف إلى الإعدادات.');
          return;
        }

        if (filename.endsWith('SecureVaultScreen.js')) {
          let scheduleDisabled = false;
          let syncDisabled = false;
          let cardDefaultPatched = false;
          let cardPayloadPatched = false;
          let displayPatched = false;
          let formPatched = false;

          programPath.traverse({
            VariableDeclarator(path) {
              if (t.isIdentifier(path.node.id, { name: 'scheduleCardReminder' })) {
                path.node.init = t.arrowFunctionExpression([], t.booleanLiteral(false), true);
                scheduleDisabled = true;
              }
              if (t.isIdentifier(path.node.id, { name: 'syncCardReminders' })) {
                path.node.init = t.arrowFunctionExpression([], t.blockStatement([]), true);
                syncDisabled = true;
              }
              if (t.isIdentifier(path.node.id, { name: 'startAddCard' }) && t.isArrowFunctionExpression(path.node.init)) {
                path.traverse({
                  ObjectExpression(innerPath) {
                    const isCard = innerPath.node.properties.some((property) => t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'record_type' }) && t.isStringLiteral(property.value, { value: 'card' }));
                    if (!isCard) return;
                    const hasDay = innerPath.node.properties.some((property) => t.isObjectProperty(property) && ((t.isIdentifier(property.key) && property.key.name === 'statement_day') || (t.isStringLiteral(property.key) && property.key.value === 'statement_day')));
                    if (!hasDay) innerPath.node.properties.push(t.objectProperty(t.identifier('statement_day'), t.stringLiteral('1')));
                    cardDefaultPatched = true;
                    innerPath.stop();
                  },
                });
              }
            },

            FunctionDeclaration(path) {
              if (t.isIdentifier(path.node.id, { name: 'preparePayload' })) {
                path.traverse({
                  IfStatement(innerPath) {
                    if (!isModeCardTest(innerPath.node.test)) return;
                    if (!t.isBlockStatement(innerPath.node.consequent)) return;

                    innerPath.node.consequent.body = innerPath.node.consequent.body.filter((statement) => !containsString(statement, 'حدد يوم الكشف من 1 إلى 31'));
                    innerPath.node.consequent.body.unshift(
                      t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('payload'), t.identifier('statement_day')), t.numericLiteral(1)))
                    );
                    cardPayloadPatched = true;
                    innerPath.stop();
                  },
                });
              }
            },

            JSXElement(path) {
              const opening = path.node.openingElement;
              if (t.isJSXIdentifier(opening.name, { name: 'Spec' }) && attrString(opening, 'label') === 'تاريخ الكشف') {
                const valueAttr = getAttr(opening, 'value');
                if (valueAttr) valueAttr.value = t.stringLiteral('حسب جدول البنك');
                else opening.attributes.push(t.jsxAttribute(t.jsxIdentifier('value'), t.stringLiteral('حسب جدول البنك')));
                displayPatched = true;
              }
            },

            ConditionalExpression(path) {
              if (!containsString(path.node, 'تاريخ الكشف')) return;
              const sadadInput = findFormInput(path.node.consequent, 'رقم سداد');
              if (!sadadInput) return;
              path.node.consequent = t.cloneNode(sadadInput, true);
              path.node.alternate = t.nullLiteral();
              formPatched = true;
            },

            StringLiteral(path) {
              if (path.node.value === 'تم حفظ البطاقة. الإشعار يعمل في نسخة التطبيق الداعمة للإشعارات.') {
                path.node.value = 'تم حفظ البطاقة. تنبيه الكشف يعتمد على جدول البنك.';
              }
              if (path.node.value.includes('وسيتم تنبيهك في يوم الكشف.')) {
                path.node.value = path.node.value.replace('وسيتم تنبيهك في يوم الكشف.', 'ويتم تنبيه موعد الكشف تلقائيًا حسب جدول البنك.');
              }
            },
          });

          if (!scheduleDisabled || !syncDisabled) throw programPath.buildCodeFrameError('تعذر تعطيل تنبيهات كشف البطاقة الفردية.');
          if (!cardDefaultPatched || !cardPayloadPatched) throw programPath.buildCodeFrameError('تعذر تحويل تاريخ الكشف إلى جدول البنك.');
          if (!displayPatched || !formPatched) throw programPath.buildCodeFrameError('تعذر تحديث واجهة تاريخ الكشف في الخزنة.');
        }
      },
    },
  };
};
