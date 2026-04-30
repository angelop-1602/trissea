import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const child = spawn('npx lhci autorun --config=.lighthouserc.json', {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    CHROME_PATH: chromium.executablePath(),
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
