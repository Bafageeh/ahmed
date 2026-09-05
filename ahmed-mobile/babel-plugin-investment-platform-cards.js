'use strict';

module.exports = function investmentPlatformCardsPlugin({ types: t }) {
  const isTargetFile = (state) => {
    const filename = (state && state.file && state.file.opts && state.file.opts.filename) || '';
    return filename.replace(/\\/g, '/').endsWith('/AppShell.js');
  };

  const styleAttribute = (element) => element.openingElement.attributes.find((attribute) => (
    t.isJSXAttribute(attribute)
    && t.isJSXIdentifier(attribute.name, { name: 'style' })
  ));

  const styleExpression = (element) => {
    const attribute = styleAttribute(element);
    if (!attribute || !t.isJSXExpressionContainer(attribute.value)) return null;
    return attribute.value.expression;
  };

  const isStylesMember = (expression, name) => (
    t.isMemberExpression(expression)
    && !expression.computed
    && t.isIdentifier(expression.object, { name: 'styles' })
    && t.isIdentifier(expression.property, { name })
  );

  const hasStyle = (element, name) => {
    const expression = styleExpression(element);
    if (isStylesMember(expression, name)) return true;
    return t.isArrayExpression(expression)
      && expression.elements.some((item) => isStylesMember(item, name));
  };

  const replaceStyle = (element, expression) => {
    const attribute = styleAttribute(element);
    if (!attribute) return;
    attribute.value = t.jsxExpressionContainer(expression);
  };

  const objectStyle = (properties) => t.objectExpression(
    Object.entries(properties).map(([key, value]) => t.objectProperty(
      t.identifier(key),
      typeof value === 'number' ? t.numericLiteral(value) : t.stringLiteral(value),
    )),
  );

  const headerElement = (iconElement, titleElement) => t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier('View'),
      [
        t.jsxAttribute(
          t.jsxIdentifier('style'),
          t.jsxExpressionContainer(objectStyle({
            alignSelf: 'stretch',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 10,
            marginBottom: 6,
          })),
        ),
      ],
      false,
    ),
    t.jsxClosingElement(t.jsxIdentifier('View')),
    [iconElement, titleElement],
    false,
  );

  return {
    name: 'ahmed-investment-platform-cards',
    visitor: {
      FunctionDeclaration(path, state) {
        if (!isTargetFile(state)) return;
        if (!path.node.id || path.node.id.name !== 'InvestmentsScreen') return;

        let updated = false;

        path.traverse({
          JSXElement(cardPath) {
            if (updated) return;

            const opening = cardPath.node.openingElement;
            if (!t.isJSXIdentifier(opening.name, { name: 'TouchableOpacity' })) return;

            const childElements = cardPath.node.children.filter((child) => t.isJSXElement(child));
            const iconElement = childElements.find((child) => (
              t.isJSXIdentifier(child.openingElement.name, { name: 'View' })
              && hasStyle(child, 'iconBox')
            ));
            const titleElement = childElements.find((child) => (
              t.isJSXIdentifier(child.openingElement.name, { name: 'Text' })
              && hasStyle(child, 'cardTitle')
            ));
            const descriptionElement = childElements.find((child) => (
              t.isJSXIdentifier(child.openingElement.name, { name: 'Text' })
              && hasStyle(child, 'cardText')
            ));

            if (!iconElement || !titleElement || !descriptionElement) return;

            replaceStyle(
              iconElement,
              t.arrayExpression([
                t.memberExpression(t.identifier('styles'), t.identifier('iconBox')),
                objectStyle({ marginBottom: 0 }),
              ]),
            );
            replaceStyle(
              titleElement,
              t.arrayExpression([
                t.memberExpression(t.identifier('styles'), t.identifier('cardTitle')),
                objectStyle({ flex: 1 }),
              ]),
            );

            cardPath.node.children = [
              headerElement(iconElement, titleElement),
              descriptionElement,
            ];
            updated = true;
          },
        });
      },
    },
  };
};
