module.exports = function appShellReportsHome({ types: t }) {
  return {
    name: 'appshell-reports-home',
    visitor: {
      Program(programPath, state) {
        const filename = String(state.filename || '');
        if (!filename.endsWith('AppShell.js')) return;

        let patched = false;
        programPath.traverse({
          VariableDeclarator(path) {
            if (patched) return;

            // AppShell declares state as:
            // const [activeTab, setActiveTab] = useState('wealth');
            // لذلك المعرف هنا ArrayPattern وليس Identifier.
            const id = path.node.id;
            if (!t.isArrayPattern(id) || id.elements.length < 1) return;
            const firstElement = id.elements[0];
            if (!t.isIdentifier(firstElement, { name: 'activeTab' })) return;

            const init = path.node.init;
            if (!t.isCallExpression(init)) return;
            if (!t.isIdentifier(init.callee, { name: 'useState' })) return;

            if (init.arguments.length) init.arguments[0] = t.stringLiteral('reports');
            else init.arguments.push(t.stringLiteral('reports'));
            patched = true;
          },
        });

        if (!patched) {
          throw programPath.buildCodeFrameError('تعذر تعيين شاشة #S-130 كتَبويب البداية: لم يتم العثور على activeTab useState.');
        }
      },
    },
  };
};
