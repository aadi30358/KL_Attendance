import { useState, useEffect } from 'react';
import { Calendar, Download, Sparkles, ExternalLink, ZoomIn, ZoomOut, RotateCcw, Check, ChevronRight, FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';

const BATCHES = {
    y24: {
        id: 'y24',
        name: 'Y23 & Y24 Batch',
        badge: 'B.Tech Y23 & Y24',
        years: 'III & IV Year UG Engineering Programs',
        academicYear: 'Academic Year 2026–27',
        pdfUrl: '/calendar_y24.pdf',
        hdImageUrl: '/calendar_y24_hd.webp',
        thumbUrl: '/calendar_y24_thumb.webp',
        accentBg: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    y25: {
        id: 'y25',
        name: 'Y25 Regular Batch',
        badge: 'B.Tech Y25 Regular',
        years: 'II Year UG Engineering (Semester)',
        academicYear: 'Academic Year 2026–27',
        pdfUrl: '/calendar_y25.pdf',
        hdImageUrl: '/calendar_y25_hd.webp',
        thumbUrl: '/calendar_y25_thumb.webp',
        accentBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    y25_tri: {
        id: 'y25_tri',
        name: 'Y25 Tri Sem Batch',
        badge: 'B.Tech Y25 Tri-Sem',
        years: 'II Year UG Engineering (Trimester)',
        academicYear: 'Academic Year 2026–27',
        pdfUrl: '/calendar_y25_tri.pdf',
        hdImageUrl: '/calendar_y25_tri_hd.webp',
        thumbUrl: '/calendar_y25_tri_thumb.webp',
        accentBg: 'bg-purple-50 text-purple-700 border-purple-200'
    }
};

export default function AcademicCalendar() {
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Preload all 3 batch calendars immediately so opening is instant with zero lag
    useEffect(() => {
        Object.values(BATCHES).forEach((b) => {
            const img = new Image();
            img.src = b.hdImageUrl;
            const thumb = new Image();
            thumb.src = b.thumbUrl;
        });
    }, []);

    const currentBatch = selectedBatch ? BATCHES[selectedBatch] : null;

    const handleSelectBatch = (batchId) => {
        setImageLoaded(false);
        setSelectedBatch(batchId);
        setZoomLevel(1);
    };

    const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
    const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
    const handleResetZoom = () => setZoomLevel(1);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadPDF = async (url, filename) => {
        setIsDownloading(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
        } catch {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.target = '_blank';
            link.click();
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#FAFAFA] selection:bg-indigo-500 selection:text-white">
            <SEO
                title="Academic Calendar 2026–27 | KL Attendance Manager"
                description="View official KL University Academic Calendar for Y23, Y24, Y25 Regular, and Y25 Tri Sem batches in Full HD without any blur."
            />

            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-blue-50/20 opacity-80" />
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-100/40 blur-3xl opacity-60" />
                <div className="absolute bottom-1/4 -left-32 w-96 h-96 rounded-full bg-indigo-100/40 blur-3xl opacity-50" />
            </div>

            <div className="relative z-10 w-full max-w-6xl mx-auto pt-24 sm:pt-28 pb-10 px-2 sm:px-6 lg:px-8 flex flex-col items-center">
                {/* --- Mode 1: Batch Selection Screen --- */}
                {!selectedBatch ? (
                    <motion.div
                        className="w-full max-w-5xl"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        {/* Top Bar with Back to Home */}
                        <div className="w-full flex items-center justify-between gap-3 mb-6 sm:mb-8">
                            <Link
                                to="/"
                                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border-2 border-black rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Home</span>
                            </Link>

                            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-white border-2 border-black shadow-sm text-[11px] sm:text-xs font-bold text-slate-800">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse shrink-0" />
                                <span>Official 2026–27</span>
                            </div>
                        </div>

                        {/* Page Title */}
                        <div className="text-center mb-8 sm:mb-10 px-2">
                            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2.5 sm:gap-3">
                                <Calendar className="w-7 h-7 sm:w-10 sm:h-10 text-indigo-600 drop-shadow-sm shrink-0" />
                                <span>Academic Calendar</span>
                            </h1>
                            <p className="mt-2.5 text-xs sm:text-base text-slate-600 font-medium max-w-xl mx-auto">
                                Select your batch below to view the official schedule in crystal-clear Full HD.
                            </p>
                        </div>

                        {/* Batch Cards Grid (3 Batches) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                            {/* Y23 & Y24 Card */}
                            <motion.div
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelectBatch('y24')}
                                className="group relative bg-white border-2 border-black rounded-2xl sm:rounded-[2rem] p-5 sm:p-7 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-4 sm:mb-5">
                                        <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] sm:text-xs font-black tracking-wider uppercase">
                                            {BATCHES.y24.badge}
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center group-hover:bg-indigo-700 transition-colors shadow-sm">
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>

                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1.5">
                                        {BATCHES.y24.name}
                                    </h2>
                                    <p className="text-slate-600 font-bold text-xs sm:text-sm mb-2">
                                        {BATCHES.y24.years}
                                    </p>
                                    <p className="text-slate-400 text-xs font-mono mb-5">
                                        Official Schedule • {BATCHES.y24.academicYear}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 uppercase tracking-wider">
                                        <FileText className="w-3.5 h-3.5" /> Full HD
                                    </span>
                                    <span className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider group-hover:bg-indigo-700 transition-colors">
                                        Open
                                    </span>
                                </div>
                            </motion.div>

                            {/* Y25 Regular Card */}
                            <motion.div
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelectBatch('y25')}
                                className="group relative bg-white border-2 border-black rounded-2xl sm:rounded-[2rem] p-5 sm:p-7 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-4 sm:mb-5">
                                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] sm:text-xs font-black tracking-wider uppercase">
                                            {BATCHES.y25.badge}
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center group-hover:bg-emerald-700 transition-colors shadow-sm">
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>

                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1.5">
                                        {BATCHES.y25.name}
                                    </h2>
                                    <p className="text-slate-600 font-bold text-xs sm:text-sm mb-2">
                                        {BATCHES.y25.years}
                                    </p>
                                    <p className="text-slate-400 text-xs font-mono mb-5">
                                        Official Schedule • {BATCHES.y25.academicYear}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-wider">
                                        <FileText className="w-3.5 h-3.5" /> Full HD
                                    </span>
                                    <span className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider group-hover:bg-emerald-700 transition-colors">
                                        Open
                                    </span>
                                </div>
                            </motion.div>

                            {/* Y25 Tri Sem Card */}
                            <motion.div
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSelectBatch('y25_tri')}
                                className="group relative bg-white border-2 border-black rounded-2xl sm:rounded-[2rem] p-5 sm:p-7 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-4 sm:mb-5">
                                        <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] sm:text-xs font-black tracking-wider uppercase">
                                            {BATCHES.y25_tri.badge}
                                        </span>
                                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center group-hover:bg-purple-700 transition-colors shadow-sm">
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>

                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1.5">
                                        {BATCHES.y25_tri.name}
                                    </h2>
                                    <p className="text-slate-600 font-bold text-xs sm:text-sm mb-2">
                                        {BATCHES.y25_tri.years}
                                    </p>
                                    <p className="text-slate-400 text-xs font-mono mb-5">
                                        Official Schedule • {BATCHES.y25_tri.academicYear}
                                    </p>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-purple-600 flex items-center gap-1 uppercase tracking-wider">
                                        <FileText className="w-3.5 h-3.5" /> Full HD
                                    </span>
                                    <span className="px-3.5 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-wider group-hover:bg-purple-700 transition-colors">
                                        Open
                                    </span>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                ) : (
                    /* --- Mode 2: Perfect Full HD Calendar View (With Back Option & Mobile-Fit Controls) --- */
                    <motion.div
                        className="w-full max-w-5xl flex flex-col items-center"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        {/* Top Bar: Batch Switcher Only (Back Button is at Bottom) */}
                        <div className="w-full flex items-center justify-center sm:justify-end gap-3 mb-4 sm:mb-6">
                            {/* Batch Switcher Pills (3 Batches) */}
                            <div className="w-full sm:w-auto grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1 bg-white border-2 border-black p-1 sm:p-1.5 rounded-xl shadow-sm">
                                <button
                                    onClick={() => handleSelectBatch('y24')}
                                    className={`px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1 ${
                                        selectedBatch === 'y24'
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    {selectedBatch === 'y24' && <Check className="w-3 h-3 text-white shrink-0 hidden sm:inline" />}
                                    <span className="truncate">Y23 & Y24</span>
                                </button>

                                <button
                                    onClick={() => handleSelectBatch('y25')}
                                    className={`px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1 ${
                                        selectedBatch === 'y25'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    {selectedBatch === 'y25' && <Check className="w-3 h-3 text-white shrink-0 hidden sm:inline" />}
                                    <span className="truncate">Y25 Regular</span>
                                </button>

                                <button
                                    onClick={() => handleSelectBatch('y25_tri')}
                                    className={`px-1.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-black transition-all uppercase tracking-wider flex items-center justify-center gap-1 ${
                                        selectedBatch === 'y25_tri'
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                >
                                    {selectedBatch === 'y25_tri' && <Check className="w-3 h-3 text-white shrink-0 hidden sm:inline" />}
                                    <span className="truncate">Y25 Tri-Sem</span>
                                </button>
                            </div>
                        </div>

                        {/* Calendar Header Card */}
                        <div className="w-full bg-white border-2 border-black rounded-2xl p-4 sm:p-6 mb-3 sm:mb-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-black tracking-wider uppercase border ${currentBatch.accentBg}`}>
                                        {currentBatch.badge}
                                    </span>
                                    <span className="text-[11px] sm:text-xs text-slate-500 font-mono font-bold">
                                        {currentBatch.academicYear}
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">
                                    {currentBatch.name} Academic Calendar
                                </h2>
                                <p className="text-slate-600 text-xs sm:text-sm font-medium mt-0.5">
                                    {currentBatch.years}
                                </p>
                            </div>

                            {/* Actions & Zoom Controls */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
                                <div className="flex items-center justify-between sm:justify-start gap-1 bg-slate-100 border border-slate-300 rounded-xl p-1 flex-1 sm:flex-none">
                                    <button
                                        onClick={handleZoomOut}
                                        title="Zoom Out"
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors active:scale-95"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-mono font-black text-slate-700 min-w-[2.5rem] text-center">
                                        {Math.round(zoomLevel * 100)}%
                                    </span>
                                    <button
                                        onClick={handleZoomIn}
                                        title="Zoom In"
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors active:scale-95"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleResetZoom}
                                        title="Reset Zoom"
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors active:scale-95"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleDownloadPDF(currentBatch.pdfUrl, `${currentBatch.id}_academic_calendar.pdf`)}
                                        disabled={isDownloading}
                                        className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all border-2 border-black active:scale-95 cursor-pointer disabled:opacity-75"
                                    >
                                        {isDownloading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Download className="w-3.5 h-3.5" />
                                        )}
                                        <span>{isDownloading ? 'Downloading...' : 'PDF'}</span>
                                    </button>

                                    <a
                                        href={currentBatch.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border-2 border-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Open</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Calendar Display Box with Snug Edges, Mobile Touch Pan & Quick Presets */}
                        <div className="w-full bg-white border-2 border-black rounded-2xl shadow-xl overflow-hidden mb-6">
                            {/* Mobile Quick Bar with Preset Zoom Buttons */}
                            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                                <span className="flex items-center gap-1.5 font-bold text-slate-700">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Full HD (Drag to Pan)
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setZoomLevel(1)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all ${
                                            zoomLevel === 1 ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                    >
                                        Fit
                                    </button>
                                    <button
                                        onClick={() => setZoomLevel(1.5)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all ${
                                            zoomLevel === 1.5 ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                    >
                                        1.5x
                                    </button>
                                    <button
                                        onClick={() => setZoomLevel(2)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all ${
                                            zoomLevel === 2 ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                    >
                                        2x
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Container with Smooth Native Touch Scrolling */}
                            <div
                                className="w-full max-h-[75vh] sm:max-h-[85vh] overflow-x-auto overflow-y-auto p-1 sm:p-3 bg-white"
                                style={{
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-x pan-y pinch-zoom'
                                }}
                            >
                                <div
                                    style={{
                                        width: zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%`,
                                        minWidth: zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%`,
                                        transition: 'width 0.2s ease-out'
                                    }}
                                    className="relative mx-auto"
                                >
                                    {/* Instant Blur Placeholder (loads in <10ms for zero visual lag) */}
                                    {!imageLoaded && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden">
                                            <img
                                                src={currentBatch.thumbUrl}
                                                alt="Fast Preview"
                                                className="w-full h-auto block filter blur-sm scale-105 opacity-70"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-slate-300 shadow-md text-xs font-bold text-slate-800">
                                                    <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                                                    <span>Rendering Full HD...</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* High Speed Full HD WebP (preloaded into cache) */}
                                    <img
                                        src={currentBatch.hdImageUrl}
                                        alt={`${currentBatch.name} Official Academic Calendar`}
                                        onLoad={() => setImageLoaded(true)}
                                        className={`w-full h-auto block rounded-lg select-none transition-opacity duration-200 ${
                                            imageLoaded ? 'opacity-100' : 'opacity-0'
                                        }`}
                                        draggable={false}
                                        loading="eager"
                                        decoding="async"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bottom Back Button */}
                        <div className="flex items-center justify-center gap-4 w-full pb-8">
                            <button
                                onClick={() => { setSelectedBatch(null); setZoomLevel(1); }}
                                className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 border-2 border-black rounded-xl font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Batch Selection</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
