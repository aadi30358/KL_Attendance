import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const buildTimestamp = Date.now()

function buildVersionPlugin() {
  return {
    name: 'build-version-plugin',
    buildStart() {
      const versionData = JSON.stringify({
        version: buildTimestamp,
        buildTime: new Date(buildTimestamp).toISOString()
      }, null, 2);

      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.resolve(publicDir, 'version.json'), versionData);

      // Update sw.js CACHE_NAME dynamically so every build changes SW bytes
      const swPath = path.resolve(publicDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf8');
        swContent = swContent.replace(/const CACHE_NAME = 'kl-attendance-[^']*';/, `const CACHE_NAME = 'kl-attendance-v${buildTimestamp}';`);
        fs.writeFileSync(swPath, swContent);
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_TIME__: buildTimestamp
  },
  plugins: [react(), buildVersionPlugin()],
  server: {
    proxy: {
      '/index.php': {
        target: 'https://newerp.kluniversity.in',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: { "*": "" }, // Crucial for session cookies to be saved locally regardless of IP/localhost
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://newerp.kluniversity.in');
            proxyReq.setHeader('referer', 'https://newerp.kluniversity.in/');
            // Forward IP to simulate real requester
            const clientIp = req.socket?.remoteAddress || '192.168.1.1';
            proxyReq.setHeader('x-forwarded-for', clientIp);
          });
        }
      },
      '/api': {
        target: 'https://api.klattendance.online',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@google/generative-ai')) {
              return 'gemini-ai';
            }
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-generator';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'recharts';
            }
            if (id.includes('firebase')) {
              return 'firebase-core';
            }
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-icons';
            }
            if (id.includes('react-icons')) {
              return 'react-icons';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1200
  }
})
