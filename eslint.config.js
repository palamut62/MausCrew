// Flat config. The codebase had no linter at all, so the bar here is "catch
// the classes of bug review keeps missing", not "impose a style" — Prettier is
// deliberately absent and formatting rules are off.
//
// Most rules are warnings on purpose: a first run over 44k lines that fails the
// build teaches everyone to pass --no-verify. Only the ones that mean a real
// defect are errors.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/** Generated, vendored, or packaged output — none of it is ours to lint. */
const IGNORED = [
  "dist/**",
  "dist-server/**",
  "dist-electron/**",
  "dist-native/**",
  "release/**",
  "build/**",
  "output/**",
  "coverage/**",
  ".playwright-cli/**",
  ".worktrees/**",
  ".mauscrew-scratch/**",
  ".tmp-wheel-inspect/**",
  "electron/vendor/**",
];

/** `_name` is the codebase's existing "deliberately discarded" idiom — it is
 * how a secret is stripped from an object before it is echoed back. */
const UNUSED = [
  "error",
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true },
];

export default tseslint.config(
  { ignores: IGNORED },
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": UNUSED,
      // The drivers normalise other people's protocols; `any` at that seam is a
      // decision, not an accident. Worth seeing, not worth blocking on.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      // `catch {}` is this codebase's deliberate "best effort, never take down
      // the stream" idiom and it is commented as such everywhere it appears.
      "no-empty": ["error", { allowEmptyCatch: true }],
      // `let x = ""` before a try/catch that assigns on both paths is a
      // readability choice, not a defect.
      "no-useless-assignment": "warn",
      "preserve-caught-error": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      // The emoji strip in tts/speech-text.ts spans variation selectors on
      // purpose — it wants to remove them, not preserve the grapheme.
      "no-misleading-character-class": "warn",
      "no-console": "off",
      eqeqeq: ["warn", "smart"],
      "no-var": "error",
      "prefer-const": "warn",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // rules-of-hooks is the classic correctness rule and stays an error. The
      // rest of the v7 recommended set is React Compiler readiness — worth
      // seeing, but this app deliberately keeps a `stateRef.current` mirror and
      // folds SSE frames into state from effects, so failing the build on those
      // would only teach everyone to skip the linter.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // A stale closure in the SSE fold shows up as a message that never
      // arrives, which is the hardest kind of bug to see in this app.
      "react-hooks/exhaustive-deps": "warn",
      // The approval cards are the consent surface; an icon-only button with no
      // name there is not a nitpick.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/control-has-associated-label": "off",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": [
        "warn",
        // onError/onLoad are resource lifecycle, not user interaction; the icon
        // fallback chains in PluginsPanel and Avatar are not a11y defects.
        { handlers: ["onClick", "onMouseDown", "onMouseUp", "onKeyPress", "onKeyDown", "onKeyUp"] },
      ],
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/label-has-associated-control": ["warn", { depth: 4 }],
    },
  },
  {
    files: [
      "server/**/*.{ts,mjs}",
      "electron/**/*.{mjs,cjs}",
      "scripts/**/*.mjs",
      "test-sweep/scripts/**/*.mjs",
      "*.ts",
      "*.mjs",
      "*.js",
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // The live/probe sweep scripts run on modern Node, whose web-compatible
    // globals (fetch, AbortController, TextDecoder, URL) are not included in
    // the globals package's Node preset yet.
    files: ["test-sweep/scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // CommonJS by extension: the Electron preload and its helpers cannot be ESM.
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["**/*.test.{ts,tsx,mjs}", "server/testing/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
