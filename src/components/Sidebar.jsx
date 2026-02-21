import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Home,
    BookOpen,
    CalendarDays,
    List,
    Users,
    Building,
    LibraryBig,
} from 'lucide-react';

const Sidebar = ({ isMobileOpen }) => {
    const [hovered, setHovered] = useState(false);
    const location = useLocation();

    const navItems = [
        { name: 'Home', icon: Home, path: '/' },
        { name: 'Total Attendance', icon: Users, path: '/attendance' },
        { name: 'LTPS Calculator', icon: BookOpen, path: '/ltps' },
        { name: 'Subject Attendance', icon: List, path: '/subject-attendance' },
        { name: 'Academic Calendar', icon: CalendarDays, path: '/calendar' },
        { name: 'Study Hub', icon: LibraryBig, path: '/study' },
        { name: 'Admin Dashboard', icon: Building, path: '/admin' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div
            className={`fixed left-0 top-0 h-full bg-white/90 backdrop-blur-xl border-r border-slate-200 text-slate-700 transition-all duration-300 z-50 flex flex-col shadow-xl ${hovered ? 'w-72' : 'w-[3.5rem]'
                } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Brand Area */}
            <div className="h-14 flex items-center px-2 py-3 border-b border-slate-100">
                <Link to="/" className="flex items-center gap-3 w-full overflow-hidden">
                    <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                        <img src="/klu_new_logo.png" alt="KL" className="h-8 w-auto object-contain rounded-lg" />
                    </div>
                    <div className={`flex flex-col transition-all duration-300 ${hovered ? 'opacity-100' : 'opacity-0 w-0'} overflow-hidden`}>
                        <span className="font-black text-lg text-slate-900 whitespace-nowrap leading-tight">KL ERP</span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">Attendance Calculator</span>
                    </div>
                </Link>
            </div>

            {/* Navigation Menu */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1">
                {navItems.map((item, index) => (
                    <Link
                        key={index}
                        to={item.path}
                        title={!hovered ? item.name : undefined}
                        className={`w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive(item.path)
                            ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm border border-indigo-100'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                    >
                        <span className="shrink-0 flex items-center justify-center w-5">
                            <item.icon
                                size={18}
                                strokeWidth={isActive(item.path) ? 2.5 : 2}
                                className={isActive(item.path) ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}
                            />
                        </span>
                        <span className={`ml-3 text-sm whitespace-nowrap transition-all duration-300 ${hovered ? 'opacity-100' : 'opacity-0 w-0'} overflow-hidden`}>
                            {item.name}
                        </span>
                        {isActive(item.path) && hovered && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                        )}
                    </Link>
                ))}
            </div>

            {/* Footer brand */}
            <div className={`border-t border-slate-100 px-3 py-3 transition-all duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
                <p className="text-[10px] text-slate-300 font-medium text-center whitespace-nowrap">KL ERP Attendance Calculator</p>
            </div>
        </div>
    );
};

export default Sidebar;


