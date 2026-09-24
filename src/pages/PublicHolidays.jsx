import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import SEO from '../components/SEO';
import {
    PUBLIC_HOLIDAYS_2026,
    SUNDAY_FESTIVALS_2026,
    OPTIONAL_HOLIDAYS_2026,
    SOCIAL_SERVICE_ACTIVITIES_2026
} from '../data/holidays2026';

export default function PublicHolidays() {
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'general', 'optional', 'sunday', 'social'

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const scrollToSection = (id) => {
        setActiveTab(id);
        if (id !== 'all') {
            const el = document.getElementById(id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    // High-Resolution Official Vector PDF Generator (Works seamlessly across mobile & desktop)
    const downloadHolidaysPDF = () => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let y = 14;

            const drawPageHeader = () => {
                // Official University Header
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.setTextColor(15, 45, 100); // KLU Royal Blue
                doc.text("KLEF (DEEMED TO BE UNIVERSITY)", pageWidth / 2, y, { align: "center" });

                y += 6;
                doc.setFontSize(11);
                doc.setTextColor(30, 41, 59);
                doc.text("Official List of Public Holidays - Calendar Year 2026", pageWidth / 2, y, { align: "center" });

                y += 5;
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                doc.text("Green Fields, Vaddeswaram, Guntur Dist., A.P. - 522302 • klattendance.online", pageWidth / 2, y, { align: "center" });

                y += 3;
                doc.setDrawColor(203, 213, 225); // Slate 300
                doc.setLineWidth(0.4);
                doc.line(14, y, pageWidth - 14, y);
                y += 6;
            };

            const drawPageFooter = (pageNum, totalPages) => {
                const footerY = pageHeight - 10;
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.3);
                doc.line(14, footerY - 3, pageWidth - 14, footerY - 3);

                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(148, 163, 184);
                doc.text("Koneru Lakshmaiah Education Foundation • Approved by UGC / AICTE", 14, footerY + 1);
                doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 14, footerY + 1, { align: "right" });
            };

            drawPageHeader();

            // 1. GENERAL HOLIDAYS
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text("1. GENERAL HOLIDAYS", 14, y);
            y += 3.5;

            // Table Header
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            doc.rect(14, y, 182, 6.5, 'FD');
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("NO.", 17, y + 4.5);
            doc.text("DATE", 32, y + 4.5);
            doc.text("DAY", 80, y + 4.5);
            doc.text("OCCASION", 125, y + 4.5);
            y += 6.5;

            doc.setFont("helvetica", "normal");
            PUBLIC_HOLIDAYS_2026.forEach((h) => {
                const hasSub = h.subOccasions && h.subOccasions.length > 0;
                const rowHeight = hasSub ? 11 : 5.8;
                doc.rect(14, y, 182, rowHeight, 'S');
                doc.setTextColor(51, 65, 85);
                doc.text(String(h.no), 18, y + 4);
                doc.setFont("helvetica", "bold");
                doc.text(h.date, 32, y + 4);
                doc.setFont("helvetica", "normal");
                doc.text(h.day, 80, y + 4);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(h.occasion, 125, y + 4);

                if (hasSub) {
                    doc.setFontSize(6.8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(100, 116, 139);
                    doc.text(h.subOccasions.join(" | "), 125, y + 8);
                    doc.setFontSize(7.5);
                }
                y += rowHeight;
            });

            y += 5;

            // 2. OPTIONAL HOLIDAYS
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text("2. OPTIONAL HOLIDAYS", 14, y);
            y += 3.5;

            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, 182, 6.5, 'FD');
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("SL. NO.", 17, y + 4.5);
            doc.text("DATE", 32, y + 4.5);
            doc.text("DAY", 80, y + 4.5);
            doc.text("OCCASION", 125, y + 4.5);
            y += 6.5;

            doc.setFont("helvetica", "normal");
            OPTIONAL_HOLIDAYS_2026.forEach((h) => {
                doc.rect(14, y, 182, 5.8, 'S');
                doc.setTextColor(51, 65, 85);
                doc.text(String(h.no), 18, y + 4);
                doc.setFont("helvetica", "bold");
                doc.text(h.date, 32, y + 4);
                doc.setFont("helvetica", "normal");
                doc.text(h.day, 80, y + 4);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(h.occasion, 125, y + 4);
                y += 5.8;
            });

            y += 5;

            // 3. SUNDAY FESTIVALS
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text("3. FESTIVALS OCCURRING ON SUNDAY", 14, y);
            y += 3.5;

            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, 182, 6.5, 'FD');
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("SL. NO.", 17, y + 4.5);
            doc.text("DATE", 45, y + 4.5);
            doc.text("OCCASION", 110, y + 4.5);
            y += 6.5;

            doc.setFont("helvetica", "normal");
            SUNDAY_FESTIVALS_2026.forEach((h) => {
                doc.rect(14, y, 182, 5.8, 'S');
                doc.setTextColor(51, 65, 85);
                doc.text(String(h.no), 18, y + 4);
                doc.setFont("helvetica", "bold");
                doc.text(h.date, 45, y + 4);
                doc.setTextColor(15, 23, 42);
                doc.text(h.occasion, 110, y + 4);
                y += 5.8;
            });

            y += 5;

            // 4. SOCIAL SERVICE ACTIVITIES
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text("4. SOCIAL SERVICE ACTIVITIES", 14, y);
            y += 3.5;

            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, 182, 6.5, 'FD');
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("NO.", 17, y + 4.5);
            doc.text("DATE", 32, y + 4.5);
            doc.text("DAY", 65, y + 4.5);
            doc.text("OCCASION & DESCRIPTION", 100, y + 4.5);
            y += 6.5;

            doc.setFont("helvetica", "normal");
            SOCIAL_SERVICE_ACTIVITIES_2026.forEach((h) => {
                const descLines = doc.splitTextToSize(h.description, 92);
                const rowHeight = Math.max(9, descLines.length * 3.4 + 5.5);
                doc.rect(14, y, 182, rowHeight, 'S');
                doc.setTextColor(51, 65, 85);
                doc.text(String(h.no), 18, y + 4);
                doc.setFont("helvetica", "bold");
                doc.text(h.date, 32, y + 4);
                doc.setFont("helvetica", "normal");
                doc.text(h.day, 65, y + 4);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(h.occasionTitle, 100, y + 4);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.8);
                doc.setTextColor(71, 85, 105);
                doc.text(descLines, 100, y + 7.8);
                doc.setFontSize(7.5);
                y += rowHeight;
            });

            // Draw Footer on Page 1
            drawPageFooter(1, 1);

            // Trigger High-Reliability Native Download for Mobile & Desktop
            const pdfBlob = doc.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            const downloadLink = document.createElement('a');
            downloadLink.href = blobUrl;
            downloadLink.download = 'KLU_Official_Public_Holidays_2026.pdf';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        } catch (err) {
            console.error("PDF generation failed:", err);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#F8FAFC] selection:bg-slate-900 selection:text-white">
            <SEO
                title="Public Holidays 2026 | KL Attendance Manager"
                description="Official List of Public Holidays, Optional Holidays, Sunday Festivals, and Social Service Activities for Calendar Year 2026 - KL University."
            />

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-100/60 via-white to-slate-100/40" />
            </div>

            {/* Main Content Container with safe clearance for fixed top navbar */}
            <div className="relative z-10 w-full max-w-5xl mx-auto pt-24 sm:pt-28 pb-12 px-2.5 sm:px-6 lg:px-8 flex flex-col items-center">
                
                {/* Top Navigation Bar with Back to Home & Download PDF */}
                <div className="w-full flex items-center justify-between gap-2.5 mb-4 sm:mb-6">
                    <Link
                        to="/"
                        className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-black rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 hover:-translate-x-0.5"
                    >
                        <ArrowLeft className="w-4 h-4 shrink-0" />
                        <span>Back to Home</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={downloadHolidaysPDF}
                            className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-900 hover:bg-black text-white border-2 border-black rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            <Download className="w-4 h-4 shrink-0" />
                            <span>Download PDF</span>
                        </button>

                        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border-2 border-black shadow-sm text-xs font-bold text-slate-800">
                            <Calendar className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                            <span>Official 2026</span>
                        </div>
                    </div>
                </div>

                {/* Filter Navigation Pills (Pure Touch Smooth Scrolling) */}
                <div className="w-full mb-5 sm:mb-6 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => scrollToSection('all')}
                        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border-2 border-black shadow-sm ${
                            activeTab === 'all'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                    >
                        View All
                    </button>
                    <button
                        onClick={() => scrollToSection('general')}
                        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border-2 border-black shadow-sm ${
                            activeTab === 'general'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                    >
                        General (11)
                    </button>
                    <button
                        onClick={() => scrollToSection('optional')}
                        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border-2 border-black shadow-sm ${
                            activeTab === 'optional'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                    >
                        Optional (2)
                    </button>
                    <button
                        onClick={() => scrollToSection('sunday')}
                        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border-2 border-black shadow-sm ${
                            activeTab === 'sunday'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                    >
                        Sunday Festivals (2)
                    </button>
                    <button
                        onClick={() => scrollToSection('social')}
                        className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border-2 border-black shadow-sm ${
                            activeTab === 'social'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-800 hover:bg-slate-100'
                        }`}
                    >
                        Social Service (3)
                    </button>
                </div>

                {/* --- 1. GENERAL HOLIDAYS CARD --- */}
                {(activeTab === 'all' || activeTab === 'general') && (
                    <motion.div
                        id="general"
                        className="w-full bg-white border-2 border-black rounded-2xl shadow-md overflow-hidden mb-6 sm:mb-8"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Header with light divider */}
                        <div className="border-b border-slate-200 p-3.5 sm:p-6 bg-white">
                            <h1 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                                List of Public Holidays for the Calendar Year 2026
                            </h1>
                            <p className="text-[11px] sm:text-sm font-black text-slate-600 tracking-wider uppercase mt-1">
                                GENERAL HOLIDAYS
                            </p>
                        </div>

                        {/* Mobile Swipe Hint with light divider */}
                        <div className="block sm:hidden bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-500">
                            👉 Swipe horizontally to view full table
                        </div>

                        {/* Table with Light Borders Inside - Unrestricted Touch Scrolling */}
                        <div className="overflow-x-auto w-full p-1.5 sm:p-4 bg-white" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                            <table className="w-full text-left border-collapse border border-slate-200 bg-white">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 w-12 sm:w-16 text-center">
                                            No.
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[135px] sm:min-w-[180px]">
                                            DATE
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[120px] sm:min-w-[160px]">
                                            DAY
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[200px]">
                                            OCCASION
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs sm:text-sm font-medium text-slate-800 bg-white">
                                    {PUBLIC_HOLIDAYS_2026.map((h) => (
                                        <tr key={h.no} className="bg-white hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 text-center font-mono font-bold text-slate-600">
                                                {h.no}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-mono font-bold whitespace-nowrap text-slate-800">
                                                {h.date}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-semibold whitespace-nowrap text-slate-700">
                                                {h.day}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200">
                                                <div className="font-bold text-sm text-slate-900">
                                                    {h.no === 1 ? 'Pongal Holidays' : h.occasion}
                                                </div>
                                                {h.subOccasions && h.subOccasions.length > 0 && (
                                                    <div className="mt-1.5 space-y-1 pl-2 text-xs text-slate-600 font-medium">
                                                        {h.subOccasions.map((sub, sIdx) => (
                                                            <div key={sIdx} className="flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                                                <span>{sub}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* --- 2. OPTIONAL HOLIDAYS CARD --- */}
                {(activeTab === 'all' || activeTab === 'optional') && (
                    <motion.div
                        id="optional"
                        className="w-full bg-white border-2 border-black rounded-2xl shadow-md overflow-hidden mb-6 sm:mb-8"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="border-b border-slate-200 p-3.5 sm:p-6 bg-white">
                            <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight">
                                OPTIONAL HOLIDAYS
                            </h2>
                        </div>

                        <div className="block sm:hidden bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-500">
                            👉 Swipe horizontally to view full table
                        </div>

                        <div className="overflow-x-auto w-full p-1.5 sm:p-4 bg-white" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                            <table className="w-full text-left border-collapse border border-slate-200 bg-white">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 w-12 sm:w-16 text-center">
                                            Sl. No.
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[135px] sm:min-w-[180px]">
                                            DATE
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[120px] sm:min-w-[160px]">
                                            DAY
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[180px]">
                                            OCCASION
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs sm:text-sm font-medium text-slate-800 bg-white">
                                    {OPTIONAL_HOLIDAYS_2026.map((h) => (
                                        <tr key={h.no} className="bg-white hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 text-center font-mono font-bold text-slate-600">
                                                {h.no}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-mono font-bold whitespace-nowrap text-slate-800">
                                                {h.date}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-semibold whitespace-nowrap text-slate-700">
                                                {h.day}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-bold text-sm text-slate-900">
                                                {h.occasion}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* --- 3. FESTIVALS OCCURRING ON SUNDAY --- */}
                {(activeTab === 'all' || activeTab === 'sunday') && (
                    <motion.div
                        id="sunday"
                        className="w-full bg-white border-2 border-black rounded-2xl shadow-md overflow-hidden mb-6 sm:mb-8"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="border-b border-slate-200 p-3.5 sm:p-6 bg-white">
                            <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight">
                                <span className="underline decoration-2 underline-offset-4">Following Festivals occur on Sunday</span>
                            </h2>
                        </div>

                        <div className="block sm:hidden bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-500">
                            👉 Swipe horizontally to view full table
                        </div>

                        <div className="overflow-x-auto w-full p-1.5 sm:p-4 bg-white" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                            <table className="w-full text-left border-collapse border border-slate-200 bg-white">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 w-12 sm:w-16 text-center">
                                            Sl. No.
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[135px] sm:min-w-[180px]">
                                            DATE
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[180px]">
                                            OCCASION
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs sm:text-sm font-medium text-slate-800 bg-white">
                                    {SUNDAY_FESTIVALS_2026.map((h) => (
                                        <tr key={h.no} className="bg-white hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 text-center font-mono font-bold text-slate-600">
                                                {h.no}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-mono font-bold whitespace-nowrap text-slate-800">
                                                {h.date}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-bold text-sm text-slate-900">
                                                {h.occasion}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* --- 4. SOCIAL SERVICE ACTIVITIES --- */}
                {(activeTab === 'all' || activeTab === 'social') && (
                    <motion.div
                        id="social"
                        className="w-full bg-white border-2 border-black rounded-2xl shadow-md overflow-hidden mb-6 sm:mb-8"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="border-b border-slate-200 p-3.5 sm:p-6 bg-white">
                            <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight">
                                <span className="underline decoration-2 underline-offset-4">SOCIAL SERVICE ACTIVITIES</span>
                            </h2>
                        </div>

                        <div className="block sm:hidden bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-500">
                            👉 Swipe horizontally to view full table
                        </div>

                        <div className="overflow-x-auto w-full p-1.5 sm:p-4 bg-white" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
                            <table className="w-full text-left border-collapse border border-slate-200 bg-white">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold uppercase tracking-wider">
                                        <th className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 w-12 sm:w-16 text-center">
                                            No.
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[135px] sm:min-w-[180px]">
                                            DATE
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[120px] sm:min-w-[150px]">
                                            DAY
                                        </th>
                                        <th className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 min-w-[220px]">
                                            OCCASION
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs sm:text-sm font-medium text-slate-800 bg-white">
                                    {SOCIAL_SERVICE_ACTIVITIES_2026.map((h) => (
                                        <tr key={h.no} className="bg-white hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-2 sm:py-3 sm:px-4 border border-slate-200 text-center font-mono font-bold text-slate-600">
                                                {h.no}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-mono font-bold whitespace-nowrap text-slate-800">
                                                {h.date}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 font-semibold whitespace-nowrap text-slate-700">
                                                {h.day}
                                            </td>
                                            <td className="py-2.5 px-2.5 sm:py-3 sm:px-6 border border-slate-200 text-slate-900">
                                                <div className="font-bold text-sm text-slate-900 mb-1">
                                                    {h.occasionTitle}
                                                </div>
                                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                                                    {h.description}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* Bottom Back to Home & Download PDF Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pb-8">
                    <button
                        onClick={downloadHolidaysPDF}
                        className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-black text-white border-2 border-black rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        <span>Download Official PDF</span>
                    </button>
                    <Link
                        to="/"
                        className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-black rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Home</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
