import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import { APP_CONFIG } from './config';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { useDeploymentSync } from './services/useDeploymentSync';
import { initConsolePortfolio } from './services/consolePortfolio';
import { prewarmCaptcha } from './services/erpService';

import { AuthProvider } from './context/AuthContext';
import { AttendanceProvider } from './context/AttendanceContext';
import { InstallPwaPrompt } from './components/InstallPwaPrompt';
import { InstallModal } from './components/InstallModal';
import { DeveloperModal } from './components/DeveloperModal';
import { InactivityTracker } from './components/InactivityTracker';
import { ErrorBoundary } from './components/ErrorBoundary';

// ─── Lazy-loaded pages (only loaded when the user navigates to that route) ───
const Home             = lazy(() => import('./pages/Home'));
const LTPSCalculator   = lazy(() => import('./pages/LTPSCalculator'));
const StudyHub         = lazy(() => import('./pages/StudyHub'));
const SubjectAttendance = lazy(() => import('./pages/SubjectAttendance'));
const AdminDashboard   = lazy(() => import('./pages/AdminDashboard'));
const TotalAttendance  = lazy(() => import('./pages/TotalAttendance'));
const AcademicCalendar = lazy(() => import('./pages/AcademicCalendar'));
const Login            = lazy(() => import('./pages/Login'));
const AttendanceRegister = lazy(() => import('./pages/AttendanceRegister'));
const Predictor        = lazy(() => import('./pages/Predictor'));
const PublicHolidays   = lazy(() => import('./pages/PublicHolidays'));
const UserProfile      = lazy(() => import('./pages/UserProfile'));
const PlutoAssistant   = lazy(() => import('./pages/PlutoAssistant'));
const BunkSimulator    = lazy(() => import('./pages/BunkSimulator'));
const Grades           = lazy(() => import('./pages/Grades'));
const Timetable        = lazy(() => import('./pages/Timetable'));
const FeedbackWidget   = lazy(() => import('./components/FeedbackWidget'));

import { HelmetProvider } from 'react-helmet-async';
import { FaGithub, FaLinkedin, FaInstagram, FaTelegram } from 'react-icons/fa6';

// Tiny placeholder shown while a lazy page chunk loads (usually < 100ms on Firebase CDN)
const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const SOCIAL_LINKS = [
  {
    name: 'GitHub',
    href: 'https://github.com/aadi30358',
    icon: FaGithub,
    hoverClass: 'hover:text-slate-900 hover:bg-slate-200/70',
  },
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/in/garlapati-yaswanth-adithya-reddy-226108367',
    icon: FaLinkedin,
    hoverClass: 'hover:text-[#0A66C2] hover:bg-blue-50',
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/adithyareddy.7/',
    icon: FaInstagram,
    hoverClass: 'hover:text-[#E4405F] hover:bg-pink-50',
  },
  {
    name: 'Telegram',
    href: 'https://t.me/kl2400030358',
    icon: FaTelegram,
    hoverClass: 'hover:text-[#229ED9] hover:bg-sky-50',
  },
];

const AppWithAuth = () => {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isErpPortal = location.pathname === '/login' || 
                      location.pathname === '/attendance-register' || 
                      location.pathname === '/timetable' || 
                      location.pathname === '/grades' || 
                      location.pathname === '/cgpa' || 
                      location.pathname === '/bunk-simulator' || 
                      location.pathname === '/bunk';

  // Activate cross-domain instant deployment synchronization
  useDeploymentSync();

  // Initialize developer console portfolio easter egg & console commands
  useEffect(() => {
    const cleanup = initConsolePortfolio();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);


  // Keep backend warm — runs AFTER browser is idle so it never delays rendering
  useEffect(() => {
    const pingBackend = () => {
      const url = `${APP_CONFIG.API_URL || ''}/api/health`;
      if (url.startsWith('http')) {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 6000);
          fetch(url, { signal: controller.signal, cache: 'no-store' })
            .catch(() => {})
            .finally(() => clearTimeout(tid));
        } catch {
          // ignore
        }
      }
    };
    // Defer first ping until idle (browser renders page first)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        pingBackend();
        prewarmCaptcha().catch(() => {});
        const interval = setInterval(pingBackend, 3 * 60 * 1000);
        return () => clearInterval(interval);
      }, { timeout: 3000 });
    } else {
      const t = setTimeout(() => {
        pingBackend();
        const interval = setInterval(pingBackend, 3 * 60 * 1000);
        return () => clearInterval(interval);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, []);


  // Visitor traffic tracking — deferred 1.5s so it never delays page paint
  useEffect(() => {
    if (isAdminPage) return;
    const track = () => {
      try {
        if (!window.__kl_visit_counted) {
          window.__kl_visit_counted = true;
          const todayStr = new Date().toISOString().slice(0, 10);
          setDoc(doc(db, 'analytics', 'traffic'), {
            totalVisits: increment(1),
            [`daily.${todayStr}`]: increment(1),
            lastVisitAt: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }
      } catch {
        // Ignore
      }
    };
    const t = setTimeout(track, 1500);
    return () => clearTimeout(t);
  }, [isAdminPage]);

  // Ensure root html has no residual dark mode class
  useEffect(() => {
    try {
      document.documentElement.classList.remove('dark');
      localStorage.removeItem('kl_theme');
    } catch {
      // ignore
    }
  }, []);

  if (isAdminPage) {
    return (
      <main className="min-h-screen font-sans">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </Suspense>
      </main>
    );
  }

  return (
    <div className={isErpPortal ? "h-screen h-[100dvh] bg-[#F4F6F9] font-sans text-slate-900 flex flex-col overflow-hidden selection:bg-indigo-500 selection:text-white" : "min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900"}>
      <Navbar />

      <main className={isErpPortal ? "flex-1 min-h-0 flex flex-col overflow-hidden" : ""}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/attendance" element={<TotalAttendance />} />
            <Route path="/attendance-register" element={<AttendanceRegister />} />
            <Route path="/timetable" element={<Timetable />} />
            <Route path="/grades" element={<Grades />} />
            <Route path="/cgpa" element={<Grades />} />
            <Route path="/ltps" element={<LTPSCalculator />} />
            <Route path="/calendar" element={<AcademicCalendar />} />
            <Route path="/holidays" element={<PublicHolidays />} />
            <Route path="/study" element={<StudyHub />} />
            <Route path="/subject-attendance" element={<SubjectAttendance />} />
            <Route path="/predictor" element={<Predictor />} />
            <Route path="/bunk-simulator" element={<BunkSimulator />} />
            <Route path="/bunk" element={<BunkSimulator />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/pluto" element={<PlutoAssistant />} />
            <Route path="/coding-assistant" element={<PlutoAssistant />} />
          </Routes>
        </Suspense>
      </main>

      <DeveloperModal />
      <InstallModal />
      <InstallPwaPrompt />
      <InactivityTracker />
      <Suspense fallback={null}><FeedbackWidget /></Suspense>

      {!isErpPortal && (
        <footer className="w-full py-6 text-center border-t border-slate-200/80 bg-white/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5">
            <p className="font-bold text-sm text-slate-500">
              © 2025, G.Yaswanth Adithya Reddy - 2400030358
            </p>
            <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-slate-300">
              {SOCIAL_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                    title={item.name}
                    className={`p-1.5 rounded-lg text-slate-400 ${item.hoverClass} transition-all duration-200 hover:scale-110 active:scale-95`}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <AttendanceProvider>
          <ErrorBoundary>
            <Router>
              <AppWithAuth />
            </Router>
          </ErrorBoundary>
        </AttendanceProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;