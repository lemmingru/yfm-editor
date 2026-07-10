import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const cargoBinDir = join(homedir(), '.cargo', 'bin');

function commandExists(command) {
  const result = isWindows
    ? spawnSync('where', [command], {stdio: 'ignore'})
    : spawnSync('sh', ['-c', `command -v ${command}`], {stdio: 'ignore'});
  return result.status === 0;
}

function cargoInstalledOutsidePath() {
  const cargoName = isWindows ? 'cargo.exe' : 'cargo';
  return existsSync(join(cargoBinDir, cargoName));
}

function xcodeCommandLineToolsInstalled() {
  const result = spawnSync('xcode-select', ['-p'], {stdio: 'ignore'});
  return result.status === 0;
}

function printInstallHelp() {
  console.error(`
Tauri requires the Rust toolchain, but Cargo was not found.

Install Rust, then restart your terminal or reload Cargo's environment:

  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  . "$HOME/.cargo/env"

macOS also needs Xcode Command Line Tools:

  xcode-select --install

After installation, verify the setup with:

  cargo --version
`);
}

if (!commandExists('cargo')) {
  if (cargoInstalledOutsidePath()) {
    console.error(`
Cargo is installed in ${cargoBinDir}, but this terminal has not loaded it into PATH yet.

Run this once, then try again:

  . "$HOME/.cargo/env"

Or open a new terminal window.
`);
    process.exit(1);
  }

  printInstallHelp();
  process.exit(1);
}

if (process.platform === 'darwin' && !xcodeCommandLineToolsInstalled()) {
  console.error(`
Tauri on macOS requires Xcode Command Line Tools.

Install them with:

  xcode-select --install
`);
  process.exit(1);
}
