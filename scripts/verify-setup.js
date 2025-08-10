#!/usr/bin/env node

// Verification script for monorepo setup
import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying monorepo setup...\n');

const checks = [
  {
    name: 'Root package.json has workspaces',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return pkg.workspaces && pkg.workspaces.includes('packages/*');
    }
  },
  {
    name: 'Shared package exists',
    check: () => fs.existsSync('packages/shared/package.json')
  },
  {
    name: 'Backend package exists',
    check: () => fs.existsSync('packages/backend/package.json')
  },
  {
    name: 'API routes directory exists',
    check: () => fs.existsSync('api')
  },
  {
    name: 'Lib directory exists',
    check: () => fs.existsSync('lib')
  },
  {
    name: 'Docker Compose configuration exists',
    check: () => fs.existsSync('docker-compose.yml')
  },
  {
    name: 'Environment configuration exists',
    check: () => fs.existsSync('.env.example') && fs.existsSync('lib/config/env.ts')
  },
  {
    name: 'Vercel configuration exists',
    check: () => fs.existsSync('vercel.json')
  },
  {
    name: 'TypeScript configuration updated',
    check: () => {
      const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
      return tsconfig.references && tsconfig.references.some(ref => ref.path === './packages/shared');
    }
  },
  {
    name: 'ESLint configuration supports monorepo',
    check: () => {
      const eslintConfig = fs.readFileSync('eslint.config.js', 'utf8');
      return eslintConfig.includes('packages/backend') && eslintConfig.includes('packages/shared');
    }
  }
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, check }) => {
  try {
    if (check()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name} (Error: ${error.message})`);
    failed++;
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n🎉 Monorepo setup is complete and verified!');
  console.log('\nNext steps:');
  console.log('1. Run `npm run docker:up` to start PostgreSQL and Redis');
  console.log('2. Run `npm run dev` to start both frontend and backend');
  console.log('3. Proceed to Task 2: Shared Types and Validation Setup');
} else {
  console.log('\n⚠️  Some checks failed. Please review the setup.');
  process.exit(1);
}