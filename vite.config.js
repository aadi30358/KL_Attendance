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
        autoRewrite: true,
        cookieDomainRewrite: { "*": "" },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('origin', 'https://newerp.kluniversity.in');
            proxyReq.setHeader('referer', 'https://newerp.kluniversity.in/');
            const clientIp = req.socket?.remoteAddress || '192.168.1.1';
            proxyReq.setHeader('x-forwarded-for', clientIp);

            // Forward client-provided x-erp-cookie to ERP Cookie header with deduplication
            const erpCookie = req.headers['x-erp-cookie'];
            if (erpCookie) {
              const currentCookie = proxyReq.getHeader('cookie') || '';
              const map = new Map();
              if (currentCookie) {
                currentCookie.split(';').forEach(p => {
                  const [k, ...v] = p.split('=');
                  if (k && k.trim()) map.set(k.trim(), v.join('=').trim());
                });
              }
              // Authoritative client ERP cookie overrides any conflicting browser cookie
              erpCookie.split(';').forEach(p => {
                const [k, ...v] = p.split('=');
                if (k && k.trim()) map.set(k.trim(), v.join('=').trim());
              });
              const mergedCookie = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
              proxyReq.setHeader('cookie', mergedCookie);
            }
          });

          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Rewrite 302 location to relative URL to prevent browser CORS blocks
            if (proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location.replace(/^https?:\/\/newerp\.kluniversity\.in/i, '');
            }

            // Expose Set-Cookie and strip Secure for HTTP localhost compatibility
            if (proxyRes.headers['set-cookie']) {
              const sc = Array.isArray(proxyRes.headers['set-cookie'])
                ? proxyRes.headers['set-cookie']
                : [proxyRes.headers['set-cookie']];
              proxyRes.headers['set-cookie'] = sc.map(c =>
                c.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=Strict/gi, '; SameSite=Lax')
              );
              const cookieStr = sc.map(c => c.split(';')[0]).join('; ');
              proxyRes.headers['x-set-erp-cookie'] = cookieStr;
            }

            res.setHeader('Access-Control-Expose-Headers', 'x-set-erp-cookie, location, set-cookie');
          });
        }
      },
      '/api': {
        target: 'http://localhost:3000',
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
