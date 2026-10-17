import React from 'react';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('KL Attendance Uncaught UI Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  handleClearCacheAndReload = () => {
    try {
      // Clear session data that might be corrupted while keeping auth if possible
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl text-center transform-gpu">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Oops, Something went wrong
            </h2>

            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-2 leading-relaxed">
              Don&apos;t worry! Your attendance and login data are safe. A temporary display issue occurred.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-left text-xs font-mono text-red-700 overflow-auto max-h-48 whitespace-pre-wrap select-text">
                <div className="font-bold mb-1">{this.state.error.toString()}</div>
                <div className="text-[10px] text-red-500 leading-normal">{this.state.error.stack}</div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200 active:scale-95 cursor-pointer text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>

              <button
                onClick={this.handleReset}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer text-sm"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium py-1 transition-colors"
              >
                Clear Temp Cache & Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
