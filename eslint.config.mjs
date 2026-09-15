import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**", "**/.turbo/**", "docs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["**/*.mjs", "**/*.cjs", "**/vite.config.ts", "**/vitest.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
