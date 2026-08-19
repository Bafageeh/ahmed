'use strict';

module.exports = function debtDetailExtraStatsPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/DebtsLoansScreen.js');
  };

  const stylesMember = (name) => t.memberExpression(t.identifier('styles'), t.identifier(name));
  const member = (name) => t.memberExpression(t.identifier('debt'), t.identifier(name));
  const call = (name, args) => t.callExpression(t.identifier(name), args);

  const styleAttrName = (openingElement) => {
    if (!openingElement) return null;
    const attr = openingElement.attributes.find((attribute) => (
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name: 'style' })
      && t.isJSXExpressionContainer(attribute.value)
    ));
    if (!attr) return null;
    const expression = attr.value.expression;
    if (!t.isMemberExpression(expression)) return null;
    if (!t.isIdentifier(expression.object, { name: 'styles' })) return null;
    if (!t.isIdentifier(expression.property)) return null;
    return expression.property.name;
  };

  const setStyleAttr = (openingElement, name) => {
    const attr = openingElement.attributes.find((attribute) => (
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name: 'style' })
    ));
    if (attr) attr.value = t.jsxExpressionContainer(stylesMember(name));
  };

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

  const gridHasLabel = (grid, label) => grid.children.some((child) => {
    if (!t.isJSXElement(child)) return false;
    if (!t.isJSXIdentifier(child.openingElement.name, { name: 'MiniStat' })) return false;
    return child.openingElement.attributes.some((attribute) => (
      t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name, { name: 'label' })
      && t.isStringLiteral(attribute.value, { value: label })
    ));
  });

  const isDetailStatsGrid = (element) => {
    if (!t.isJSXIdentifier(element.openingElement.name, { name: 'View' })) return false;
    return styleAttrName(element.openingElement) === 'detailStatsGrid';
  };

  const jsxTextValue = (element) => element.children
    .filter((child) => t.isJSXText(child))
    .map((child) => child.value)
    .join('')
    .trim();

  const mainHeaderTitle = () => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('View'),
      [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(stylesMember('topTitleWrap')))],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier('View')),
    [
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('Text'),
          [
            t.jsxAttribute(
              t.jsxIdentifier('style'),
              t.jsxExpressionContainer(t.arrayExpression([stylesMember('topTitle'), stylesMember('mainTopTitle')])),
            ),
          ],
          false,
        ),
        t.jsxClosingElement(t.jsxIdentifier('Text')),
        [t.jsxText('ديوني')],
        false,
      ),
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier('Text'),
          [t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(stylesMember('screenCode')))],
          false,
        ),
        t.jsxClosingElement(t.jsxIdentifier('Text')),
        [t.jsxText('#S-124')],
        false,
      ),
    ],
    false,
  );

  const prop = (name, value) => t.objectProperty(t.identifier(name), value);
  const num = (value) => t.numericLiteral(value);
  const str = (value) => t.stringLiteral(value);

  const styleObjects = {
    topBar: t.objectExpression([
      prop('flexDirection', str('row')),
      prop('alignItems', str('center')),
      prop('paddingHorizontal', num(16)),
      prop('paddingTop', num(5)),
      prop('paddingBottom', num(8)),
      prop('minHeight', num(58)),
    ]),
    backButton: t.objectExpression([
      prop('width', num(44)), prop('height', num(44)), prop('borderRadius', num(15)),
      prop('backgroundColor', str('#ffffff')), prop('borderWidth', num(1)), prop('borderColor', str('#dbe3ea')),
      prop('alignItems', str('center')), prop('justifyContent', str('center')),
    ]),
    topTitle: t.objectExpression([
      prop('flex', num(1)), prop('color', str('#0f172a')), prop('fontSize', num(22)),
      prop('fontWeight', str('900')), prop('textAlign', str('center')), prop('textAlignVertical', str('center')),
    ]),
    content: t.objectExpression([
      prop('paddingHorizontal', num(18)), prop('paddingTop', num(6)), prop('paddingBottom', num(36)),
    ]),
    detailContent: t.objectExpression([
      prop('paddingHorizontal', num(18)), prop('paddingTop', num(6)), prop('paddingBottom', num(40)),
    ]),
  };

  const extraStyles = {
    topBarSpacer: t.objectExpression([prop('width', num(44)), prop('height', num(44))]),
    topTitleWrap: t.objectExpression([
      prop('flex', num(1)), prop('minHeight', num(44)), prop('alignItems', str('center')), prop('justifyContent', str('center')),
    ]),
    mainTopTitle: t.objectExpression([prop('flex', num(0))]),
    screenCode: t.objectExpression([
      prop('marginTop', num(1)), prop('color', str('#94a3b8')), prop('fontSize', num(9)),
      prop('fontWeight', str('800')), prop('letterSpacing', num(0.2)), prop('textAlign', str('center')),
    ]),
  };

  const keyName = (property) => {
    if (t.isIdentifier(property.key)) return property.key.name;
    if (t.isStringLiteral(property.key)) return property.key.value;
    return null;
  };

  return {
    name: 'ahmed-debt-detail-extra-stats',
    visitor: {
      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id) return;

        if (path.node.id.name === 'DebtDetailHero') {
          path.traverse({
            JSXElement(jsxPath) {
              const grid = jsxPath.node;
              if (!isDetailStatsGrid(grid)) return;

              const stats = [
                ['الدفعة الأولى', call('money', [member('down_payment')])],
                ['تاريخ البدء', t.conditionalExpression(
                  member('contract_date'),
                  call('dateLabel', [member('contract_date')]),
                  t.stringLiteral('-'),
                )],
                ['مبلغ الربح', call('money', [member('profit_amount')])],
                ['هامش الربح', t.conditionalExpression(
                  t.binaryExpression('!=', member('profit_margin'), t.nullLiteral()),
                  call('percent', [member('profit_margin')]),
                  t.stringLiteral('-'),
                )],
                ['الأقساط المتبقية', call('String', [
                  t.conditionalExpression(
                    t.binaryExpression('!=', member('remaining_installments_count'), t.nullLiteral()),
                    member('remaining_installments_count'),
                    t.numericLiteral(0),
                  ),
                ])],
              ];

              stats.forEach(([label, expression]) => {
                if (!gridHasLabel(grid, label)) grid.children.push(miniStat(label, expression));
              });

              jsxPath.skip();
            },
          });
        }

        if (path.node.id.name === 'DebtsScreen') {
          path.traverse({
            JSXElement(jsxPath) {
              const element = jsxPath.node;
              const opening = element.openingElement;

              if (t.isJSXIdentifier(opening.name, { name: 'View' })
                && opening.selfClosing
                && styleAttrName(opening) === 'backButton') {
                setStyleAttr(opening, 'topBarSpacer');
                return;
              }

              if (t.isJSXIdentifier(opening.name, { name: 'Text' })
                && styleAttrName(opening) === 'topTitle'
                && jsxTextValue(element) === '#S-124 ديوني') {
                jsxPath.replaceWith(mainHeaderTitle());
                jsxPath.skip();
              }
            },
          });
        }
      },

      CallExpression(path, state) {
        if (!isTargetFile(state)) return;
        const callee = path.node.callee;
        if (!t.isMemberExpression(callee)) return;
        if (!t.isIdentifier(callee.object, { name: 'StyleSheet' }) || !t.isIdentifier(callee.property, { name: 'create' })) return;
        const stylesObject = path.node.arguments[0];
        if (!t.isObjectExpression(stylesObject)) return;

        stylesObject.properties.forEach((property) => {
          if (!t.isObjectProperty(property)) return;
          const name = keyName(property);
          if (name && styleObjects[name]) property.value = t.cloneNode(styleObjects[name], true);
        });

        Object.entries(extraStyles).forEach(([name, value]) => {
          const exists = stylesObject.properties.some((property) => t.isObjectProperty(property) && keyName(property) === name);
          if (!exists) stylesObject.properties.push(prop(name, t.cloneNode(value, true)));
        });
      },
    },
  };
};
