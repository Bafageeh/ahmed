'use strict';

module.exports = function mercedesFinanceAnalysisPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const styles = (name) => t.memberExpression(t.identifier('styles'), t.identifier(name));
  const debt = (name) => t.memberExpression(t.identifier('debt'), t.identifier(name));
  const nCall = (expression) => t.callExpression(t.identifier('n'), [expression]);
  const moneyCall = (expression) => t.callExpression(t.identifier('money'), [expression]);
  const percentCall = (expression) => t.callExpression(t.identifier('percent'), [expression]);
  const sub = (a, b) => t.binaryExpression('-', a, b);
  const add = (a, b) => t.binaryExpression('+', a, b);
  const mul = (a, b) => t.binaryExpression('*', a, b);
  const div = (a, b) => t.binaryExpression('/', a, b);

  const miniStat = (label, valueExpression) => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('MiniStat'),
      [
        t.jsxAttribute(t.jsxIdentifier('label'), t.stringLiteral(label)),
        t.jsxAttribute(t.jsxIdentifier('value'), t.jsxExpressionContainer(valueExpression)),
      ],
      true,
    ),
    null,
    [],
    true,
  );

  const textNode = (styleName, text) => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('Text'),
      [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(styles(styleName)))],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier('Text')),
    [t.jsxText(text)],
    false,
  );

  const financing = nCall(debt('financing_amount'));
  const original = nCall(debt('original_amount'));
  const profit = nCall(debt('profit_amount'));
  const installmentsCount = nCall(debt('installments_count'));
  const extraDifference = sub(sub(t.cloneNode(original, true), t.cloneNode(financing, true)), t.cloneNode(profit, true));
  const totalIncrease = sub(t.cloneNode(original, true), t.cloneNode(financing, true));

  const guardedPercent = (numerator) => percentCall(
    t.conditionalExpression(
      t.binaryExpression('>', t.cloneNode(financing, true), t.numericLiteral(0)),
      mul(div(numerator, t.cloneNode(financing, true)), t.numericLiteral(100)),
      t.numericLiteral(0),
    ),
  );

  const guardedAnnual = (numerator) => percentCall(
    t.conditionalExpression(
      t.logicalExpression(
        '&&',
        t.binaryExpression('>', t.cloneNode(financing, true), t.numericLiteral(0)),
        t.binaryExpression('>', t.cloneNode(installmentsCount, true), t.numericLiteral(0)),
      ),
      mul(
        div(
          mul(div(numerator, t.cloneNode(financing, true)), t.numericLiteral(12)),
          t.cloneNode(installmentsCount, true),
        ),
        t.numericLiteral(100),
      ),
      t.numericLiteral(0),
    ),
  );

  const analysisCard = () => {
    const grid = t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('View'),
        [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(styles('detailStatsGrid')))],
        false,
      ),
      t.jsxClosingElement(t.jsxIdentifier('View')),
      [
        miniStat('مبلغ التمويل الرئيسي', moneyCall(t.cloneNode(financing, true))),
        miniStat('الربح المعلن', moneyCall(t.cloneNode(profit, true))),
        miniStat('الفرق الإضافي', moneyCall(t.cloneNode(extraDifference, true))),
        miniStat('إجمالي الزيادة على الأصل', moneyCall(t.cloneNode(totalIncrease, true))),
        miniStat('نسبة الزيادة الكلية', guardedPercent(t.cloneNode(totalIncrease, true))),
        miniStat('هامش الربح السنوي المعلن', guardedAnnual(t.cloneNode(profit, true))),
        miniStat('الهامش السنوي شامل الفرق', guardedAnnual(t.cloneNode(totalIncrease, true))),
        miniStat('IRR الشهري', t.stringLiteral('0.598% تقريبًا')),
        miniStat('APR الاسمي السنوي', t.stringLiteral('7.18% تقريبًا')),
        miniStat('IRR السنوي الفعلي', t.stringLiteral('7.42% تقريبًا')),
        miniStat('XIRR السنوي', t.stringLiteral('7.41% تقريبًا')),
        miniStat('هيكل الأقساط المتبقية', t.stringLiteral('45 × 5,627.67 + 163,526.20 ر.س')),
      ],
      false,
    );

    const card = t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('View'),
        [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(styles('mercedesAnalysisCard')))],
        false,
      ),
      t.jsxClosingElement(t.jsxIdentifier('View')),
      [
        textNode('mercedesAnalysisTitle', 'تحليل تمويل المرسيدس'),
        grid,
        textNode('mercedesAnalysisNote', 'المعدل الفعلي مبني على جدول الدفعات الكامل والدفعة الأخيرة الكبيرة. الفرق الإضافي هو الجزء غير المصنف كربح في بيانات جهة التمويل.'),
      ],
      false,
    );

    const nameCheck = t.callExpression(
      t.memberExpression(
        t.callExpression(t.identifier('String'), [
          t.logicalExpression('||', debt('name'), t.stringLiteral('')),
        ]),
        t.identifier('includes'),
      ),
      [t.stringLiteral('مرسيدس')],
    );

    return t.jsxExpressionContainer(
      t.logicalExpression(
        '&&',
        t.logicalExpression('&&', t.identifier('debt'), nameCheck),
        card,
      ),
    );
  };

  const keyName = (property) => {
    if (t.isIdentifier(property.key)) return property.key.name;
    if (t.isStringLiteral(property.key)) return property.key.value;
    return null;
  };

  const prop = (name, value) => t.objectProperty(t.identifier(name), value);
  const str = (value) => t.stringLiteral(value);
  const num = (value) => t.numericLiteral(value);

  return {
    name: 'ahmed-mercedes-finance-analysis',
    visitor: {
      FunctionDeclaration(path, state) {
        if (!isTargetFile(state) || !path.node.id || path.node.id.name !== 'DebtDetailHero') return;

        path.traverse({
          ReturnStatement(returnPath) {
            if (!t.isJSXFragment(returnPath.node.argument)) return;
            const fragment = returnPath.node.argument;
            const alreadyAdded = fragment.children.some((child) => (
              t.isJSXExpressionContainer(child)
              && JSON.stringify(child).includes('mercedesAnalysisCard')
            ));
            if (!alreadyAdded) fragment.children.push(analysisCard());
            returnPath.skip();
          },
        });
      },

      CallExpression(path, state) {
        if (!isTargetFile(state)) return;
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        if (!t.isIdentifier(callee.object, { name: 'StyleSheet' }) || !t.isIdentifier(callee.property, { name: 'create' })) return;
        const stylesObject = path.node.arguments[0];
        if (!t.isObjectExpression(stylesObject)) return;

        const additions = {
          mercedesAnalysisCard: t.objectExpression([
            prop('marginTop', num(14)),
            prop('paddingTop', num(16)),
            prop('paddingBottom', num(8)),
            prop('borderTopWidth', num(1)),
            prop('borderTopColor', str('#e2e8f0')),
          ]),
          mercedesAnalysisTitle: t.objectExpression([
            prop('color', str('#0f172a')),
            prop('fontSize', num(20)),
            prop('fontWeight', str('900')),
            prop('textAlign', str('right')),
            prop('marginBottom', num(10)),
          ]),
          mercedesAnalysisNote: t.objectExpression([
            prop('color', str('#64748b')),
            prop('fontSize', num(12)),
            prop('lineHeight', num(20)),
            prop('textAlign', str('right')),
            prop('marginTop', num(4)),
            prop('marginBottom', num(8)),
          ]),
        };

        Object.entries(additions).forEach(([name, value]) => {
          const exists = stylesObject.properties.some((property) => t.isObjectProperty(property) && keyName(property) === name);
          if (!exists) stylesObject.properties.push(prop(name, value));
        });
      },
    },
  };
};
