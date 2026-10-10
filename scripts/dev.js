import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Starting KL Attendance Dev Environment...');

// Start Express Backend Server
const serverProcess = spawn('node', ['server/server.js'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
});

// Start Vite Dev Server
const viteProcess = spawn('npx', ['vite', ...process.argv.slice(2)], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
});

function cleanup() {
    console.log('\n🛑 Shutting down dev servers...');
    try {
        serverProcess.kill();
    } catch (err) {
        console.warn('Backend process kill notice:', err.message);
    }
    try {
        viteProcess.kill();
    } catch (err) {
        console.warn('Vite process kill notice:', err.message);
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
