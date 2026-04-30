import 'dotenv/config';
import { spawnSync } from 'node:child_process';

function run(command: string) {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function assertResetSafety() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset database in production (NODE_ENV=production).');
  }

  if (process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error('Set ALLOW_DB_RESET=true to run db reset.');
  }
}

function main() {
  assertResetSafety();

  console.log('Resetting database schema and reapplying migrations...');
  run('npx prisma migrate reset --force');

  console.log('Generating Prisma client...');
  run('npm run db:generate');

  console.log('Running seed...');
  run('npm run db:seed');

  console.log('Database reset complete.');
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown db reset error.';
  console.error(message);
  process.exit(1);
}
