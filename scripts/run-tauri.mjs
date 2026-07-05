import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {delimiter, join} from 'node:path';
import {spawnSync} from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const cargoBinDir = join(homedir(), '.cargo', 'bin');
const cargoName = isWindows ? 'cargo.exe' : 'cargo';
const nodeBinDir = join(process.cwd(), 'node_modules', '.bin');
const tauriArgs = process.argv.slice(2);

function withExtraPath(env = process.env) {
  const pathParts = (env.PATH ?? '').split(delimiter).filter(Boolean);
  const extraPath = [nodeBinDir];

  if (existsSync(join(cargoBinDir, cargoName))) {
    extraPath.push(cargoBinDir);
  }

  return {
    ...env,
    PATH: [...extraPath, ...pathParts.filter((part) => !extraPath.includes(part))].join(delimiter),
  };
}

const env = withExtraPath();
const doctor = spawnSync(process.execPath, ['scripts/check-tauri-env.mjs'], {
  env,
  stdio: 'inherit',
});

if (doctor.status !== 0) {
  process.exit(doctor.status ?? 1);
}

const tauri = spawnSync('tauri', tauriArgs, {
  env,
  shell: isWindows,
  stdio: 'inherit',
});

process.exit(tauri.status ?? 1);
