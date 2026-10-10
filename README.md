# KLU Attendance Ace

A college-ready web application for tracking attendance, calculating LTPS eligibility, and managing study productivity.

## 🚀 Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start Development Server:**
    ```bash
    npm run dev
    ```

3.  **Build for Production:**
    ```bash
    npm run build
    ```

## 🌐 Deployment & Architecture

### 1. Production Frontend
- **Platform**: Firebase Hosting
- **Live URL**: [https://klattendancecalculator.web.app](https://klattendancecalculator.web.app) (Site: `klattendancecalculator`)
- **Deploy Command**:
  ```bash
  npm run deploy:hosting
  ```
  *(Runs `vite build`, syncs deployment version in Firestore via `scripts/updateDeploymentDoc.js`, and deploys to Firebase Hosting)*

### 2. Production Backend (API & ERP Proxy)
- **Platform**: **Cloudflare Workers** (Global Edge Serverless)
- **Primary Endpoint**: `https://kl-attendance-api.yaswanthadithyareddy10.workers.dev`
- **Custom Domain Alias**: `https://api.klattendance.online`
- **Key Edge Endpoints**:
  - `GET /api/session-init`: Fetches fresh ERP session, CSRF token, and returns the Captcha image as a Base64 data URL.
  - `GET /api/refresh-captcha`: Refreshes captcha image with active ERP session cookie.
  - `POST /api/fast-login`: Direct, atomic ERP login forwarding student credentials, resolving 302 redirect chains, and returning authenticated session cookies (`x-set-erp-cookie`).
  - `/index.php`: Reverse-proxies ERP requests (attendance searches, courselist) with strict CORS headers (`Access-Control-Allow-Origin: https://klattendancecalculator.web.app`, `Access-Control-Allow-Credentials: true`).

### 3. Local Development Backend
- **Platform**: Local Node.js / Express Server ([server/server.js](server/server.js))
- **Local URL**: `http://localhost:3000`
- **Dev Runner**:
  ```bash
  npm run dev
  ```
  *(Spawns both the Express server on port 3000 and the Vite dev server on port 5173 with automatic `/api` proxying)*

### 4. Environment Variables ([.env](.env))
- `VITE_API_URL`: Points to `https://kl-attendance-api.yaswanthadithyareddy10.workers.dev` for production builds.
- `VITE_DEV_API_URL`: Points to `http://localhost:3000` for local dev.
- `src/config.js` and `src/services/erpService.js` automatically use `http://localhost:3000` when running on `localhost` / `127.0.0.1`, and strictly use the Cloudflare Worker URL in production.

## 📚 Features

- **ERP Attendance Integration**: Fast, atomic login with captcha sync and dynamic session year/semester discovery.
- **LTPS Calculator**: Weighted attendance calculation for Lecture, Tutorial, Practical, and Skilling.
- **Bunk Simulator**: Safe absence threshold calculator.
- **Study Hub**: Integrated tools including Focus Timer, Study Analytics, and Notes.
- **Admin Dashboard**: View student records and usage analytics.
- **Academic Calendar**: Track important dates.
- **PWA & Offline Capable**: Zero-lag deployment refresh sync via Firestore.

## 🎨 Tech Stack

- **Frontend**: React 19, Vite 7, Framer Motion, Tailwind CSS
- **Backend (Edge)**: Cloudflare Workers
- **Backend (Local)**: Express.js
- **Hosting & Database**: Firebase Hosting & Cloud Firestore
- **Icons & Charts**: Lucide React, React Icons, Recharts
 
