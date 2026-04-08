import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnnouncementBanner from './components/AnnouncementBanner';

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
import UserProfile from './pages/UserProfile';

import { HelmetProvider } from 'react-helmet-async';

import { Instagram } from 'lucide-react';

const AppWithAuth = () => {

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
          <Route path="/study" element={<StudyHub />} />
          <Route path="/subject-attendance" element={<SubjectAttendance />} />
          <Route path="/predictor" element={<Predictor />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/admin" element={<AdminDashboard />} />

        </Routes>
      </main>

      <footer className="w-full py-8 text-center text-slate-400 border-t border-slate-200 bg-white/50 backdrop-blur-sm flex flex-col items-center gap-3">
        <p className="font-bold text-sm">© 2025, G.Yaswanth Adithya Reddy - 2400030358</p>
        <a 
          href="https://www.instagram.com/_aadi7781_/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:text-pink-600 transition-all duration-300 group bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100 hover:border-pink-200 hover:bg-pink-50"
        >
          <Instagram size={16} className="group-hover:scale-110 transition-transform" />
          <span className="font-bold text-sm tracking-wide">_aadi7781_</span>
        </a>
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
