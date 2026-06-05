/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['./config/eslint/base.cjs'],
  ignorePatterns: ['dist', 'build', '.turbo', 'coverage', 'node_modules'],
};
