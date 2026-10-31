// T-170 (owner go 31 Oct 2026): every text has a role from one table.
// A top-level <Text> / <TextInput> (or Animated.Text) imported from
// react-native must carry its large-text cap: a role spread from
// src/shared/components/largeText.js ({...CAP_BODY}, {...TITLE_TEXT} …), or
// an explicit maxFontSizeMultiplier / allowFontScaling prop from the tokens.
// A Text nested inside another Text inherits its parent's cap, so it is
// exempt. Roles count only when imported from largeText.js. A bare number literal as the cap is refused: caps come from
// textScale (tokens.js) or a role constant.
const ROLE_SPREADS = new Set([
  'CAP_BODY',
  'CAP_PILL',
  'CAP_TITLE',
  'CAP_DISPLAY',
  'CAP_BADGE',
  'CAP_TAB_LABEL',
  'CAP_TIMER',
  'CAP_SUFFIX',
  'CAP_NONE',
  'TITLE_TEXT',
  'DISPLAY_TITLE_TEXT',
  'SHORT_DISPLAY_TITLE_TEXT',
  'WORD_TITLE_TEXT',
  'NAME_TEXT',
  'NAME_TITLE_TEXT',
  'LINE_TEXT',
  'TOKEN_TEXT',
]);
const CAP_PROPS = new Set(['maxFontSizeMultiplier', 'allowFontScaling']);


function elementName(name) {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${elementName(name.object)}.${name.property.name}`;
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Every top-level Text / TextInput carries a large-text cap role (T-170).' },
    schema: [],
    messages: {
      missing:
        '<{{name}}> needs a large-text role: spread one from largeText.js (CAP_BODY, TITLE_TEXT, NAME_TEXT …) or set maxFontSizeMultiplier from textScale.',
      literal: '<{{name}}> cap is a bare number: use a role from largeText.js or a textScale token.',
    },
  },
  create(context) {
    const local = new Map(); // local name -> 'Text' | 'TextInput'
    const roles = new Set(); // local names bound to a role imported from largeText.js
    let animated = null;
    // A role imported from largeText.js, or `cond ? ROLE_A : ROLE_B`. A local
    // copy with a role's name doesn't count (T-170: one table, no shadows).
    const isRole = (arg) => {
      if (arg.type === 'Identifier') return roles.has(arg.name);
      if (arg.type === 'ConditionalExpression') return isRole(arg.consequent) && isRole(arg.alternate);
      return false;
    };
    return {
      ImportDeclaration(node) {
        if (/(^|\/)largeText$/.test(node.source.value)) {
          for (const s of node.specifiers) {
            if (s.type === 'ImportSpecifier' && ROLE_SPREADS.has(s.imported.name)) roles.add(s.local.name);
          }
          return;
        }
        if (node.source.value !== 'react-native') return;
        for (const s of node.specifiers) {
          if (s.type !== 'ImportSpecifier') continue;
          const imported = s.imported.name;
          if (imported === 'Text' || imported === 'TextInput') local.set(s.local.name, imported);
          if (imported === 'Animated') animated = s.local.name;
        }
      },
      JSXOpeningElement(node) {
        const name = elementName(node.name);
        const isText = local.has(name) || (animated && name === `${animated}.Text`);
        if (!isText) return;
        // Nested inside another Text: inherits the parent's cap.
        if (local.get(name) !== 'TextInput') {
          for (let up = node.parent.parent; up; up = up.parent) {
            if (up.type === 'JSXElement') {
              const upName = elementName(up.openingElement.name);
              if (local.get(upName) === 'Text' || (animated && upName === `${animated}.Text`)) return;
              break;
            }
          }
        }
        let capped = false;
        for (const attr of node.attributes) {
          if (attr.type === 'JSXSpreadAttribute') {
            if (isRole(attr.argument)) capped = true;
            continue;
          }
          if (attr.name.type !== 'JSXIdentifier' || !CAP_PROPS.has(attr.name.name)) continue;
          capped = true;
          const value = attr.value;
          if (
            attr.name.name === 'maxFontSizeMultiplier' &&
            value?.type === 'JSXExpressionContainer' &&
            value.expression.type === 'Literal' &&
            typeof value.expression.value === 'number'
          ) {
            context.report({ node, messageId: 'literal', data: { name } });
          }
        }
        if (!capped) context.report({ node, messageId: 'missing', data: { name } });
      },
    };
  },
};
