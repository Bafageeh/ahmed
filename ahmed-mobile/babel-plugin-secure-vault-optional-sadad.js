module.exports = function secureVaultOptionalSadad({ types: t }) {
  const formCardType = () => t.memberExpression(t.identifier('form'), t.identifier('card_type'));
  const isCredit = () => t.binaryExpression('===', formCardType(), t.stringLiteral('credit'));
  const payloadCardType = () => t.memberExpression(t.identifier('payload'), t.identifier('card_type'));
  const payloadIsCredit = () => t.binaryExpression('===', payloadCardType(), t.stringLiteral('credit'));

  const labelOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((attribute) =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'label' })
    );
    return attr && t.isStringLiteral(attr.value) ? attr.value.value : null;
  };

  const styleNameOf = (opening) => {
    if (!t.isJSXOpeningElement(opening)) return null;
    const attr = opening.attributes.find((attribute) =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })
    );
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return null;
    const expression = attr.value.expression;
    return t.isMemberExpression(expression) &&
      t.isIdentifier(expression.object, { name: 'styles' }) &&
      t.isIdentifier(expression.property)
      ? expression.property.name
      : null;
  };

  return {
    name: 'secure-vault-card-rules',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('SecureVaultScreen.js')) return;

        programPath.traverse({
          JSXElement(elementPath) {
            const opening = elementPath.node.openingElement;
            const componentName = t.isJSXIdentifier(opening.name) ? opening.name.name : '';
            const label = labelOf(opening);

            // Mada has no separate card name field. Keep a technical default title
            // in the payload, but do not ask the user to enter one.
            if (componentName === 'FormInput' && label === 'اسم البطاقة') {
              const original = t.cloneNode(elementPath.node, true);
              elementPath.replaceWith(
                t.jsxExpressionContainer(t.conditionalExpression(isCredit(), original, t.nullLiteral()))
              );
              elementPath.skip();
              return;
            }

            // Mada has no statement cycle/date.
            if (componentName === 'FormInput' && label === 'تاريخ الكشف (يوم الشهر)') {
              elementPath.replaceWith(t.nullLiteral());
              elementPath.skip();
              return;
            }

            // Do not show a statement date in the saved Mada card details either.
            if (componentName === 'Spec' && label === 'تاريخ الكشف') {
              const original = t.cloneNode(elementPath.node, true);
              elementPath.replaceWith(
                t.jsxExpressionContainer(t.conditionalExpression(t.identifier('credit'), original, t.nullLiteral()))
              );
              elementPath.skip();
              return;
            }

            // Do not show a user-entered card name for Mada in the card header.
            if (componentName === 'Text' && styleNameOf(opening) === 'cardName') {
              const original = t.cloneNode(elementPath.node, true);
              elementPath.replaceWith(
                t.jsxExpressionContainer(t.conditionalExpression(t.identifier('credit'), original, t.nullLiteral()))
              );
              elementPath.skip();
            }
          },

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
            if (stringPath.node.value === 'بطاقة مدى لا تحتوي على رقم سداد. رقم البطاقة فقط يحفظ مشفرًا.') {
              stringPath.node.value = 'بطاقة مدى لا تحتاج اسم بطاقة أو تاريخ كشف أو رقم سداد. رقم البطاقة فقط يحفظ مشفرًا.';
            }
          },

          FunctionDeclaration(functionPath) {
            if (!t.isIdentifier(functionPath.node.id, { name: 'preparePayload' })) return;

            const body = functionPath.get('body');
            const statements = body.get('body');
            const payloadDeclarationIndex = statements.findIndex((statementPath) => {
              if (!statementPath.isVariableDeclaration()) return false;
              return statementPath.node.declarations.some((declaration) =>
                t.isIdentifier(declaration.id, { name: 'payload' })
              );
            });

            if (payloadDeclarationIndex >= 0) {
              statements[payloadDeclarationIndex].insertAfter(
                t.ifStatement(
                  t.logicalExpression(
                    '&&',
                    t.binaryExpression('===', t.identifier('mode'), t.stringLiteral('card')),
                    t.binaryExpression('===', payloadCardType(), t.stringLiteral('mada'))
                  ),
                  t.blockStatement([
                    t.expressionStatement(
                      t.assignmentExpression(
                        '=',
                        t.memberExpression(t.identifier('payload'), t.identifier('title')),
                        t.logicalExpression(
                          '||',
                          t.callExpression(
                            t.memberExpression(
                              t.callExpression(t.identifier('String'), [
                                t.logicalExpression('||', t.memberExpression(t.identifier('payload'), t.identifier('title')), t.stringLiteral('')),
                              ]),
                              t.identifier('trim')
                            ),
                            []
                          ),
                          t.stringLiteral('مدى')
                        )
                      )
                    ),
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('payload'), t.identifier('statement_day')), t.nullLiteral())),
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('payload'), t.identifier('credit_card_debt_id')), t.nullLiteral())),
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('payload'), t.identifier('sadad_number')), t.stringLiteral(''))),
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('payload'), t.identifier('card_brand')), t.stringLiteral('mada'))),
                  ])
                )
              );
            }

            functionPath.traverse({
              IfStatement(ifPath) {
                const test = ifPath.node.test;
                if (
                  t.isUnaryExpression(test, { operator: '!' }) &&
                  t.isCallExpression(test.argument) &&
                  t.isIdentifier(test.argument.callee, { name: 'validStatementDay' })
                ) {
                  ifPath.node.test = t.logicalExpression('&&', payloadIsCredit(), test);
                }
              },
            });
          },

          VariableDeclarator(variablePath) {
            if (!t.isIdentifier(variablePath.node.id, { name: 'scheduleCardReminder' })) return;
            const init = variablePath.node.init;
            if (!t.isArrowFunctionExpression(init) || !t.isBlockStatement(init.body)) return;

            init.body.body.unshift(
              t.ifStatement(
                t.binaryExpression(
                  '!==',
                  t.optionalMemberExpression(t.identifier('card'), t.identifier('card_type'), false, true),
                  t.stringLiteral('credit')
                ),
                t.blockStatement([
                  t.ifStatement(
                    t.optionalMemberExpression(t.identifier('card'), t.identifier('id'), false, true),
                    t.blockStatement([
                      t.expressionStatement(
                        t.awaitExpression(
                          t.callExpression(t.identifier('cancelCardReminder'), [
                            t.optionalMemberExpression(t.identifier('card'), t.identifier('id'), false, true),
                          ])
                        )
                      ),
                    ])
                  ),
                  t.returnStatement(t.booleanLiteral(false)),
                ])
              )
            );
          },
        });
      },
    },
  };
};
