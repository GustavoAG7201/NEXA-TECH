import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';

execFileSync(process.execPath, ['scripts/local-db.mjs', 'start'], { stdio: 'inherit', windowsHide: true });
const appEnv = { ...process.env };
delete appEnv.NEXATECH_OWNER_URL;
const frontendEnv = Object.fromEntries(Object.entries(appEnv).filter(([name]) =>
  name !== 'DATABASE_URL' && !name.startsWith('SMTP_')));
const options = { stdio: 'inherit', windowsHide: true };
const children = [
  spawn(process.execPath, ['server/index.mjs'], { ...options, env: appEnv }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { ...options, env: frontendEnv }),
];
const stop = () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
try {
  const [code] = await Promise.race(children.map(child => once(child, 'close')));
  if (code) process.exitCode = code;
} finally {
  stop();
}
