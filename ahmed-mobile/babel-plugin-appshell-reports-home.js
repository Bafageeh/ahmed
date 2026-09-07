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
            if (!t.isIdentifier(path.node.id, { name: 'activeTab' })) return;
            const init = path.node.init;
            if (!t.isCallExpression(init)) return;
            if (!t.isIdentifier(init.callee, { name: 'useState' })) return;
            if (!init.arguments.length) return;
            init.arguments[0] = t.stringLiteral('reports');
            patched = true;
          },
        });
      },
    },
  };
};
