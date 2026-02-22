import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AnnouncementBanner from './components/AnnouncementBanner';
import ChatAssistant from './components/ChatAssistant';
import { ChatProvider } from './context/ChatContext';
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

const AppWithAuth = () => {

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AnnouncementBanner />
      <Navbar />
      <main>
        <ChatAssistant />
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

      <footer className="w-full py-6 text-center text-slate-400 text-sm border-t border-slate-200 bg-white/50 backdrop-blur-sm">
        <p className="font-bold">© 2025, G.Yaswanth Adithya Reddy - 2400030358</p>
      </footer>
    </div>
  );
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ChatProvider>
          <AttendanceProvider>
            <Router>
              <AppWithAuth />
            </Router>
          </AttendanceProvider>
        </ChatProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
