import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  { ignores: ["dist", "node_modules", "public/tests", "public/*.js", "public/*.ts", "public/sw.js"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        process: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
      },
    },
    plugins: {
      "react": react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
      "@typescript-eslint": tseslint,
    },
    rules: {
      // React rules
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      
      // React Hooks rules
      ...reactHooks.configs.recommended.rules,
      
      // React Refresh rules
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      
      // JSX A11y rules
      ...jsxA11y.configs.recommended.rules,
      
      // TypeScript rules
      ...tseslint.configs.recommended.rules,
      
      // Custom rules
      "no-console": "off", // Allow console for development
      "no-debugger": "error",
      "no-alert": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "prefer-arrow-callback": "error",
      "arrow-spacing": "error",
      "no-duplicate-imports": "error",
      "no-useless-rename": "error",
      
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      
      // React specific rules
      "react/prop-types": "off", // Not needed with TypeScript
      "react/react-in-jsx-scope": "off", // Not needed with React 17+
      "react/jsx-uses-react": "off", // Not needed with React 17+
    },
  },
  js.configs.recommended,
];
