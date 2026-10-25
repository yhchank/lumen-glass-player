import { spawn } from 'node:child_process';
import path from 'node:path';
import electron from 'electron';

const electronPath = typeof electron === 'string' ? electron : electron.default;
const profile = path.join(process.cwd(), '.dev-userdata');
const environment = { ...process.env, LUMEN_USER_DATA_DIR: profile };
delete environment.ELECTRON_RUN_AS_NODE;

const child = spawn(
  electronPath,
  ['--no-sandbox', `--user-data-dir=${profile}`, '.'],
  { stdio: 'inherit', env: environment },
);

child.on('exit', (code) => process.exit(code ?? 0));
