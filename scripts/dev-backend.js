import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const venvDir = path.join(backendDir, 'venv');
const reqFile = path.join(backendDir, 'requirements.txt');
const hashFile = path.join(venvDir, '.requirements.hash');

const isWindows = process.platform === 'win32';

function getVenvBin(binName) {
  if (isWindows) {
    return path.join(venvDir, 'Scripts', `${binName}.exe`);
  }
  return path.join(venvDir, 'bin', binName);
}

const venvPython = getVenvBin('python');
const venvUvicorn = getVenvBin('uvicorn');

function isCompatiblePython(cmd, args = []) {
  try {
    // RapidOCR & onnxruntime memerlukan Python >= 3.8 dan < 3.13
    const res = spawnSync(
      cmd,
      [...args, '-c', 'import sys; sys.exit(0 if (3, 8) <= sys.version_info < (3, 13) else 1)'],
      { stdio: 'ignore' }
    );
    return res.status === 0;
  } catch {
    return false;
  }
}

function findSystemPython() {
  if (process.env.PYTHON && isCompatiblePython(process.env.PYTHON)) {
    return { cmd: process.env.PYTHON, args: [] };
  }

  const candidates = [];

  if (isWindows) {
    candidates.push(
      { cmd: 'py', args: ['-3.11'] },
      { cmd: 'py', args: ['-3.12'] },
      { cmd: 'py', args: ['-3.10'] },
      { cmd: 'py', args: ['-3.9'] },
      { cmd: 'py', args: ['-3'] },
      { cmd: 'python3', args: [] },
      { cmd: 'python', args: [] },
    );
  } else {
    candidates.push(
      { cmd: 'python3.11', args: [] },
      { cmd: 'python3.12', args: [] },
      { cmd: 'python3.10', args: [] },
      { cmd: 'python3.9', args: [] },
    );

    if (process.env.HOME) {
      for (const ver of ['python3.11', 'python3.12', 'python3.10', 'python3.9']) {
        const localPath = path.join(process.env.HOME, '.local', 'bin', ver);
        if (fs.existsSync(localPath)) {
          candidates.push({ cmd: localPath, args: [] });
        }
      }
    }

    candidates.push(
      { cmd: 'python3', args: [] },
      { cmd: 'python', args: [] },
    );
  }

  for (const c of candidates) {
    if (isCompatiblePython(c.cmd, c.args)) {
      return c;
    }
  }

  return null;
}

// 1. Pastikan virtual environment ada
if (!fs.existsSync(venvPython)) {
  console.log('[BACKEND] Virtual environment tidak ditemukan. Mencari interpreter Python (3.8-3.12)...');
  const py = findSystemPython();
  if (!py) {
    console.error('[BACKEND] ERROR: Python kompatibel (3.8 - 3.12) tidak ditemukan di sistem.');
    console.error('[BACKEND] Catatan: rapidocr-onnxruntime belum mendukung Python >= 3.13.');
    process.exit(1);
  }
  console.log(`[BACKEND] Membuat virtual environment di ${venvDir} menggunakan ${py.cmd}...`);
  const venvRes = spawnSync(py.cmd, [...py.args, '-m', 'venv', '--clear', venvDir], { stdio: 'inherit' });
  if (venvRes.status !== 0) {
    console.error('[BACKEND] ERROR: Gagal membuat virtual environment.');
    process.exit(venvRes.status ?? 1);
  }
}

// 2. Pastikan dependensi terpasang dan tersinkronisasi dengan requirements.txt
let needsInstall = !fs.existsSync(venvUvicorn);
let currentHash = '';

if (fs.existsSync(reqFile)) {
  currentHash = crypto.createHash('sha256').update(fs.readFileSync(reqFile)).digest('hex');
  if (!needsInstall) {
    try {
      const savedHash = fs.existsSync(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : '';
      if (savedHash !== currentHash) {
        needsInstall = true;
      }
    } catch {
      needsInstall = true;
    }
  }
}

if (needsInstall) {
  console.log('[BACKEND] Dependensi baru/belum lengkap. Menginstal paket dari requirements.txt...');
  const pipRes = spawnSync(venvPython, ['-m', 'pip', 'install', '-r', reqFile], {
    cwd: backendDir,
    stdio: 'inherit',
  });
  if (pipRes.status !== 0) {
    console.error('[BACKEND] ERROR: Gagal menginstal dependensi Python.');
    process.exit(pipRes.status ?? 1);
  }
  if (currentHash) {
    try {
      fs.writeFileSync(hashFile, currentHash, 'utf8');
    } catch {
      // Abaikan jika tidak bisa menulis file hash
    }
  }
}

// 3. Jalankan server Uvicorn
console.log('[BACKEND] Menjalankan FastAPI Uvicorn pada port 8000...');
const child = spawn(venvPython, ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
  cwd: backendDir,
  stdio: 'inherit',
});

let isShuttingDown = false;

const handleSignal = (sig) => {
  if (isShuttingDown) {
    if (child.pid) {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        try {
          child.kill('SIGKILL');
        } catch {
          // Abaikan jika sudah keluar
        }
      }
    }
    process.exit(130);
  }

  isShuttingDown = true;

  if (child.pid) {
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      process.exit(0);
    } else {
      try {
        child.kill(sig);
      } catch {
        // Abaikan jika sudah keluar
      }

      // Safety timeout: jika dalam 5 detik tidak mati, paksa SIGKILL
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // Abaikan
        }
        process.exit(1);
      }, 5000);
      timer.unref();
    }
  }
};

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

child.on('error', (err) => {
  console.error('[BACKEND] ERROR: Gagal menjalankan proses Python:', err.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
