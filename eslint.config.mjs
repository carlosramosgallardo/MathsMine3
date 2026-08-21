import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

/**
 * Baseline ESLint for the JS codebase. Next 16's core-web-vitals preset enables
 * strict React Compiler hook rules that the legacy portal does not satisfy yet;
 * those are off until the mega-components are split (MiningChain3DFPV, etc.).
 */
/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'apps/android-native/**',
      'android/**',
      'play-store-listing/**',
    ],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react/jsx-no-comment-textnodes': 'warn',
    },
  },
]

export default eslintConfig
