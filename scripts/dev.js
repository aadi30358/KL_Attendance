import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Starting KL Attendance Dev Environment...');

// Start Express Backend Server
const serverProcess = spawn(process.execPath, ['server/server.js'], {
    cwd: rootDir,
    stdio: 'inherit'
});

// Start Vite Dev Server
const viteBin = path.resolve(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const viteProcess = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
    cwd: rootDir,
    stdio: 'inherit'
});

function cleanup() {
    console.log('\n🛑 Shutting down dev servers...');
    try {
        if (serverProcess?.pid) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/T', '/F']);
            } else {
                serverProcess.kill();
            }
        }
    } catch (err) {
        console.warn('Backend process kill notice:', err.message);
    }
    try {
        if (viteProcess?.pid) {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', viteProcess.pid.toString(), '/T', '/F']);
            } else {
                viteProcess.kill();
            }
        }
    } catch (err) {
        console.warn('Vite process kill notice:', err.message);
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
