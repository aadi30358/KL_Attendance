import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const DashboardLayout = ({ children }) => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sidebar */}
            <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

            {/* Navbar */}
            <Navbar onMobileToggle={() => setIsMobileOpen(!isMobileOpen)} isDashboard={true} />

            {/* Main Content */}
            <main
                className="pt-14 lg:ml-[3.5rem] transition-all duration-300 p-4 md:p-6"
                onClick={() => {
                    if (isMobileOpen) setIsMobileOpen(false);
                }}
            >
                {children}
            </main>

            {/* Overlay for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}
        </div>
    );
};

export default DashboardLayout;
