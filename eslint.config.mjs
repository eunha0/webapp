import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
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
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        // Node.js globals
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        globalThis: 'readonly',
        
        // Web APIs
        crypto: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        
        // Cloudflare Workers types
        D1Database: 'readonly',
        D1Result: 'readonly',
        D1PreparedStatement: 'readonly',
        R2Bucket: 'readonly',
        R2Object: 'readonly',
        KVNamespace: 'readonly',
        CryptoKey: 'readonly',
        
        // Browser APIs (for frontend scripts)
        window: 'readonly',
        document: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        File: 'readonly',
        FileReader: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security,
      'no-secrets': noSecrets
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off', // Use TypeScript version instead
      
      // Code quality rules
      'no-duplicate-imports': 'error',
      'max-lines': ['warn', {
        max: 500,
        skipBlankLines: true,
        skipComments: true
      }],
      'max-lines-per-function': ['warn', {
        max: 100,
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
        tolerance: 6.0,  // Increase tolerance to reduce false positives
        ignoreContent: '^(EXAMPLE_|ABCDEFGHIJKLMNOPQRSTUVWXYZ)',
        ignoreIdentifiers: ['BASE64', 'base64', 'token', 'session', 'chars', 'characters']
      }]
    }
  }
];
