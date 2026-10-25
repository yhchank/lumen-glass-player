import { spawn } from 'node:child_process';
import path from 'node:path';
import { createServer } from 'vite';
import electron from 'electron';

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});

await server.listen();
server.printUrls();

const url = server.resolvedUrls?.local?.[0] || 'http://127.0.0.1:5173/';
const electronPath = typeof electron === 'string' ? electron : electron.default;

const childEnv = {
  ...process.env,
  VITE_DEV_SERVER_URL: url,
};
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['--no-sandbox', `--user-data-dir=${path.join(process.cwd(), '.dev-userdata')}`, '.'], {
  stdio: 'inherit',
  env: childEnv,
});

child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill();
  });
}
