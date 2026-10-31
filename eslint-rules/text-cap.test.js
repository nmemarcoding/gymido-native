/**
 * @jest-environment node
 */
// T-170: the lint guard that keeps every top-level text on a role from the one
// table (src/shared/components/largeText.js).
const { RuleTester } = require("eslint");

const rule = require("./text-cap");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});
const RN = "import { Animated, Text, TextInput } from 'react-native';\n";
const ROLES =
  "import { CAP_BODY, TITLE_TEXT, DISPLAY_TITLE_TEXT } from '../shared/components/largeText';\n";
const textScale = "import { textScale } from '../shared/theme/tokens';\n";

// RuleTester makes its own describe / it blocks (one test per case).
tester.run("text-cap", rule, {
  valid: [
    RN + ROLES + "const a = <Text {...CAP_BODY}>x</Text>;",
    RN +
      ROLES +
      "const a = <Text {...(big ? DISPLAY_TITLE_TEXT : TITLE_TEXT)}>x</Text>;",
    RN + ROLES + "const a = <TextInput {...CAP_BODY} />;",
    RN + ROLES + "const a = <Animated.Text {...CAP_BODY}>x</Animated.Text>;",
    RN +
      textScale +
      "const a = <Text maxFontSizeMultiplier={textScale.body}>x</Text>;",
    RN + "const a = <Text allowFontScaling={false}>x</Text>;",
    RN +
      ROLES +
      "const a = <Text {...CAP_BODY}>a <Text style={s}>b</Text></Text>;",
    RN +
      ROLES +
      "const a = <Text {...CAP_BODY}>{items.map((i) => <Text key={i}>{i}</Text>)}</Text>;",
    "import { Text } from 'react-native-svg';\nconst a = <Text>x</Text>;",
  ],
  invalid: [
    {
      code: RN + "const a = <Text style={s}>x</Text>;",
      errors: [{ messageId: "missing" }],
    },
    {
      code: RN + "const a = <TextInput value={v} />;",
      errors: [{ messageId: "missing" }],
    },
    {
      code: RN + "const a = <Animated.Text>x</Animated.Text>;",
      errors: [{ messageId: "missing" }],
    },
    // A local copy with a role's name is not the table.
    {
      code:
        RN +
        "const TITLE_TEXT = { maxFontSizeMultiplier: 1.3 };\nconst a = <Text {...TITLE_TEXT}>x</Text>;",
      errors: [{ messageId: "missing" }],
    },
    {
      code:
        RN + ROLES + "const a = <Text {...(big ? CAP_BODY : LOCAL)}>x</Text>;",
      errors: [{ messageId: "missing" }],
    },
    {
      code: RN + "const a = <Text maxFontSizeMultiplier={1.3}>x</Text>;",
      errors: [{ messageId: "literal" }],
    },
    // A Text inside a View inside a Text is its own top-level text.
    {
      code:
        RN +
        ROLES +
        "const a = <Text {...CAP_BODY}><View><Text>b</Text></View></Text>;",
      errors: [{ messageId: "missing" }],
    },
  ],
});
