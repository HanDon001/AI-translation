/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./base.cjs'],
  env: {
    browser: true,
    es2022: true,
  },
  plugins: ['react-hooks', 'jsx-a11y'],
  extends: [
    './base.cjs',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  settings: {
    react: { version: '18' },
  },
};
