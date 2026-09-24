import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnnouncementBanner from './components/AnnouncementBanner';
import { APP_CONFIG } from './config';
import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

import { AuthProvider } from './context/AuthContext';

import { AttendanceProvider } from './context/AttendanceContext';
import Home from './pages/Home';
import LTPSCalculator from './pages/LTPSCalculator';
import StudyHub from './pages/StudyHub';
import SubjectAttendance from './pages/SubjectAttendance';
import AdminDashboard from './pages/AdminDashboard';
import TotalAttendance from './pages/TotalAttendance';
import AcademicCalendar from './pages/AcademicCalendar';
import Login from './pages/Login';
import AttendanceRegister from './pages/AttendanceRegister';
import Predictor from './pages/Predictor';
import PublicHolidays from './pages/PublicHolidays';
import UserProfile from './pages/UserProfile';
import PlutoAssistant from './pages/PlutoAssistant';
import BunkSimulator from './pages/BunkSimulator';
import FeedbackWidget from './components/FeedbackWidget';

import { HelmetProvider } from 'react-helmet-async';

import { FaGithub, FaLinkedin, FaInstagram, FaTelegram } from 'react-icons/fa6';

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
    href: 'https://www.instagram.com/_aadi7781_/',
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

  // Keep backend warm to eliminate cold starts and latency
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
    pingBackend();
    const interval = setInterval(pingBackend, 3 * 60 * 1000); // every 3 minutes
    return () => clearInterval(interval);
  }, []);

  // Visitor traffic tracking: Record genuine website visits into Firestore analytics
  useEffect(() => {
    if (isAdminPage) return;
    try {
      const sessionMarker = 'kl_visit_counted';
      if (!sessionStorage.getItem(sessionMarker)) {
        sessionStorage.setItem(sessionMarker, 'true');
        const todayStr = new Date().toISOString().slice(0, 10);

        // Update local counter
        const currentLocal = parseInt(localStorage.getItem('kl_total_visits') || '0', 10) + 1;
        localStorage.setItem('kl_total_visits', currentLocal.toString());

        // Sync live to Firestore
        setDoc(doc(db, 'analytics', 'traffic'), {
          totalVisits: increment(1),
          [`daily.${todayStr}`]: increment(1),
          lastVisitAt: new Date().toISOString()
        }, { merge: true }).catch(err => {
          console.warn('Analytics ping notice:', err);
        });
      }
    } catch {
      // Ignore
    }
  }, [isAdminPage]);

  if (isAdminPage) {
    return (
      <main className="min-h-screen font-sans">
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AnnouncementBanner />
      <Navbar />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/attendance" element={<TotalAttendance />} />
          <Route path="/attendance-register" element={<AttendanceRegister />} />
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
      </main>

      <FeedbackWidget />

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
    </div>
  );
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <AttendanceProvider>
          <Router>
            <AppWithAuth />
          </Router>
        </AttendanceProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
