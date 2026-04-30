import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

test('production build config excludes dev-only Next type artifacts', async () => {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8')) as {
    include?: string[];
  };

  assert.ok(Array.isArray(tsconfig.include), 'tsconfig.json must define include globs');
  assert.ok(
    !tsconfig.include.includes('.next/dev/types/**/*.ts'),
    'tsconfig.json should not include .next/dev/types/**/*.ts during production builds'
  );

  const nextConfigModule = await import(pathToFileURL(path.join(process.cwd(), 'next.config.mjs')).href);
  const nextConfig = nextConfigModule.default as {
    experimental?: { isolatedDevBuild?: boolean };
  };

  assert.equal(
    nextConfig.experimental?.isolatedDevBuild,
    false,
    'next.config.mjs should disable isolatedDevBuild to avoid stale dev type artifacts on Windows builds'
  );
});

test('production install keeps the Tailwind PostCSS plugin available for builds', async () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  assert.ok(
    packageJson.dependencies?.['@tailwindcss/postcss'],
    '@tailwindcss/postcss must be in dependencies because the production build loads it from postcss.config.mjs'
  );
  assert.equal(
    packageJson.devDependencies?.['@tailwindcss/postcss'],
    undefined,
    '@tailwindcss/postcss should not be left in devDependencies when production installs omit dev packages'
  );
});

test('install scripts explicitly generate the Prisma client for pnpm-based builds', async () => {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.postinstall,
    'prisma generate',
    'package.json must run prisma generate in postinstall so pnpm installs produce the generated Prisma client before build/typecheck'
  );
});
