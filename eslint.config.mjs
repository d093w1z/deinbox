import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
});

export default [
    // --------------------
    // Base JS rules
    // --------------------
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },

    // --------------------
    // React + Next.js
    // --------------------
    {
        plugins: {
            '@next/next': nextPlugin,
            react: reactPlugin,
            'react-hooks': hooksPlugin,
        },
        rules: {
            ...hooksPlugin.configs.recommended.rules,
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
        },
    },

    // --------------------
    // TypeScript (Flat, modern)
    // --------------------
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...tsPlugin.configs['recommended-type-checked'].rules,

            // Optional but practical overrides
            '@typescript-eslint/no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-imports': 'error',
        },
    },

    // --------------------
    // Compat-only plugins
    // --------------------
    ...compat.extends(
        'plugin:jsx-a11y/recommended',
        'plugin:prettier/recommended',
    ),

    // --------------------
    // Prettier + custom rules
    // --------------------
    {
        rules: {
            'prettier/prettier': [
                'error',
                {
                    printWidth: 80,
                    tabWidth: 4,
                    singleQuote: true,
                    trailingComma: 'all',
                    bracketSpacing: true,
                    semi: true,
                    useTabs: false,
                    bracketSameLine: false,
                    jsxSingleQuote: true,
                    endOfLine: 'auto',
                    arrowParens: 'always',
                    plugins: ['prettier-plugin-tailwindcss'],
                },
            ],
            'react/react-in-jsx-scope': 'off',
        },
    },

    // --------------------
    // Ignores
    // --------------------
    {
        ignores: ['.next/*', 'node_modules/*'],
    },
];
