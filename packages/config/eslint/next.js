import base from "./base.js";
import globalsPkg from "globals";

const g = typeof globalsPkg.default !== "undefined" ? globalsPkg.default : globalsPkg;

export default [
  ...base,
  {
    languageOptions: {
      globals: {
        ...g.browser,
        React: "readonly",
        JSX: "readonly",
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
