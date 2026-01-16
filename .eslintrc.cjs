module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true
  },
  extends: [
    "eslint:recommended"
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: [
    "import"
  ],
  rules: {
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "always",
        jsx: "always",
        ts: "always",
        tsx: "always"
      }
    ],
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          "*.ts",
          "*.tsx"
        ]
      }
    ]
  },
  ignorePatterns: [
    "dist/",
    "build/"
  ],
  overrides: [
    {
      files: [
        "frontend/src/**/*.{js,jsx,ts,tsx}",
        "frontend/tests/**/*.{js,jsx,ts,tsx}"
      ],
      env: {
        browser: true
      }
    }
  ]
};
