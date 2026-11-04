import js from "@eslint/js";
import noComments from "eslint-plugin-no-comments";
import globals from "globals";

const WORKAROUND_TERMS = ["todo", "fixme", "xxx", "hack", "workaround", "work around", "for now", "temporary", "temporarily", "not ideal", "should be", "ideally", "revisit", "later"];
const JSDOC_TYPES = "\\*(?:\\s+\\*)?\\s+@(?:param|returns|type|typedef|property)\\b";

export default [
  { ignores: ["node_modules/**", "public/**", "dist/**", ".wrangler/**", ".cloudflare/**"] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.serviceworker } },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    plugins: { "no-comments": noComments },
    rules: {
      "no-comments/disallowComments": ["error", { allow: ["eslint", "global", "upstream:", JSDOC_TYPES] }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-inline-comments": "error",
      "no-warning-comments": ["error", { terms: WORKAROUND_TERMS, location: "anywhere" }],
    },
  },
];
