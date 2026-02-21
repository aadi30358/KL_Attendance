
import DashboardLayout from '../components/DashboardLayout';

const Dashboard = () => {
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-6">
                <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to KL ERP</h1>
                    <p className="text-gray-600">
                        Manage your academic journey with ease. Access course registration, attendance, fee payments, and more from the sidebar.
                    </p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Quick Access Cards */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
                        <h3 className="font-semibold text-lg mb-1">Attendance</h3>
                        <p className="text-blue-100 text-sm mb-4">Check your daily attendance records.</p>
                        <div className="text-3xl font-bold">85%</div>
                        <div className="text-xs text-blue-100 mt-1">Current Semester</div>
                    </div>

                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg shadow-green-200">
                        <h3 className="font-semibold text-lg mb-1">Fee Dues</h3>
                        <p className="text-green-100 text-sm mb-4">Outstanding amount to be paid.</p>
                        <div className="text-3xl font-bold">₹0</div>
                        <div className="text-xs text-green-100 mt-1">No pending dues</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg shadow-purple-200">
                        <h3 className="font-semibold text-lg mb-1">CGPA</h3>
                        <p className="text-purple-100 text-sm mb-4">Cumulative Grade Point Average.</p>
                        <div className="text-3xl font-bold">9.2</div>
                        <div className="text-xs text-purple-100 mt-1">Last Updated: May 2025</div>
                    </div>
                </div>

                {/* Notices or Recent Activity Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h2 className="font-bold text-lg text-gray-800 mb-4">Recent Notices</h2>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer border border-gray-100 hover:border-gray-200">
                                    <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center text-red-600 font-bold shrink-0">
                                        {10 + i} <br /> <span className="text-[10px] uppercase">May</span>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-800">Exam Schedule Released for Sem II</h4>
                                        <p className="text-sm text-gray-500 line-clamp-2">The end semester examination schedule has been... </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h2 className="font-bold text-lg text-gray-800 mb-4">Timetable Today</h2>
                        <div className="relative pl-4 space-y-6 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
                                <div className="text-sm text-gray-500 mb-1">09:00 AM - 10:30 AM</div>
                                <div className="font-medium text-gray-800">Advanced Web Development</div>
                                <div className="text-sm text-gray-500">Room 304 • Block C</div>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 ring-4 ring-white"></div>
                                <div className="text-sm text-gray-500 mb-1">11:00 AM - 12:30 PM</div>
                                <div className="font-medium text-gray-800">Cloud Computing</div>
                                <div className="text-sm text-gray-500">Lab 2 • Block A</div>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-300 ring-4 ring-white"></div>
                                <div className="text-sm text-gray-500 mb-1">02:00 PM - 03:30 PM</div>
                                <div className="font-medium text-gray-800">Machine Learning (Theory)</div>
                                <div className="text-sm text-gray-500">Room 401 • Block B</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Dashboard;
