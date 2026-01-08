module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true
  },
  extends: [
    "eslint:recommended"
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  ignorePatterns: [
    "dist/",
    "build/"
  ]
};
