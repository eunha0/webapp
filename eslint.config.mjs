import eslint from '@eslint/js';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.wrangler/**',
      'uploaded_files/**',
      'public/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.cjs'
    ]
  },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.mjs'],
    plugins: {
      security,
      'no-secrets': noSecrets
    },
    rules: {
      // Code quality rules
      'no-duplicate-imports': 'error',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'max-lines': ['warn', {
        max: 500,
        skipBlankLines: true,
        skipComments: true
      }],
      'complexity': ['warn', 15],
      'no-console': 'off',

      // Security rules
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-unsafe-regex': 'error',

      // Secrets detection
      'no-secrets/no-secrets': ['error', {
        tolerance: 5.0,
        ignoreContent: '^EXAMPLE_',
        ignoreIdentifiers: ['BASE64', 'base64', 'token', 'session']
      }]
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        globalThis: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        btoa: 'readonly',
        atob: 'readonly'
      }
    }
  }
];
