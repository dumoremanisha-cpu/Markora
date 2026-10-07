// ADR-0007 §6 / code-conventions.md §1: every user-facing string goes
// through t() from its first commit. Flags non-empty string literals
// reaching DOM text/attribute sinks (textContent, innerText, and the
// aria-label/title/alt/placeholder attributes) in UI modules.
const TEXT_PROPERTIES = new Set(['textContent', 'innerText']);
const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'alt', 'placeholder']);

/** @param {import('eslint').Rule.Node} node */
function literalStringValue(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked).join('');
  }
  return undefined;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow non-empty string literals reaching DOM text/attribute sinks; use t() from src/backend/i18n/ instead.',
    },
    schema: [],
    messages: {
      literalString:
        'User-facing string literal reaching {{sink}} — use t(key) from src/backend/i18n/ instead of a hardcoded string (code-conventions.md §1).',
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression' || node.left.property.type !== 'Identifier') {
          return;
        }
        const propName = node.left.property.name;
        if (!TEXT_PROPERTIES.has(propName) && !TEXT_ATTRIBUTES.has(propName.toLowerCase())) return;
        const value = literalStringValue(node.right);
        if (value === undefined || value.trim() === '') return;
        context.report({ node: node.right, messageId: 'literalString', data: { sink: propName } });
      },
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'setAttribute'
        ) {
          return;
        }
        const [attrNode, valueNode] = node.arguments;
        if (!attrNode || !valueNode) return;
        const attrName = literalStringValue(attrNode);
        if (attrName === undefined || !TEXT_ATTRIBUTES.has(attrName.toLowerCase())) return;
        const value = literalStringValue(valueNode);
        if (value === undefined || value.trim() === '') return;
        context.report({ node: valueNode, messageId: 'literalString', data: { sink: attrName } });
      },
    };
  },
};

export default {
  rules: {
    'no-literal-user-strings': rule,
  },
};
