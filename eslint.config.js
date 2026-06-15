import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      ".next/**/*",
      "out/**/*",
      "node_modules/**/*",
      "tsconfig.tsbuildinfo",
      "public/styles.css"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs["recommended"].rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    }
  }
];
