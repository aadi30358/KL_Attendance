/**
 * PWA Installation Manager
 * Handles beforeinstallprompt capture, cross-platform installation,
 * desktop launcher download, and unified modal event dispatching.
 */

let deferredPrompt = null;
let isManagerInitialized = false;

// Platform detection helpers
export const isStandaloneMode = () => {
    if (typeof window === 'undefined') return false;
    return Boolean(
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://')
    );
};

export const isIOSDevice = () => {
    if (typeof window === 'undefined') return false;
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
};

export const isAndroidDevice = () => {
    if (typeof window === 'undefined') return false;
    return /android/.test(window.navigator.userAgent.toLowerCase());
};

export const isWindowsDevice = () => {
    if (typeof window === 'undefined') return false;
    return /windows/.test(window.navigator.userAgent.toLowerCase());
};

export const isMacDevice = () => {
    if (typeof window === 'undefined') return false;
    return /macintosh|mac os x/.test(window.navigator.userAgent.toLowerCase());
};

export const isDesktopDevice = () => {
    return !isIOSDevice() && !isAndroidDevice();
};

export const getDeferredPrompt = () => deferredPrompt;

export const hasDeferredPrompt = () => Boolean(deferredPrompt);

/**
 * Initialize global beforeinstallprompt listener immediately
 */
export const initPwaInstallManager = () => {
    if (typeof window === 'undefined' || isManagerInitialized) return;
    isManagerInitialized = true;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar or automatic browser banner
        e.preventDefault();
        deferredPrompt = e;
        window.dispatchEvent(new CustomEvent('kl_pwa_prompt_ready'));
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        try {
            sessionStorage.setItem('kl_app_installed', 'true');
        } catch {
            // ignore
        }
        window.dispatchEvent(new CustomEvent('kl_app_installed_event'));
    });
};

/**
 * Automatically download the Universal App Launcher (.html)
 * Guaranteed to open on 100% of mobile phones (Android, iOS) and laptops (Windows, Mac)
 * without any "Can't open file" or ".download" file extension errors.
 */
export const downloadDesktopLauncher = () => {
    if (typeof window === 'undefined') return;

    const origin = (window.location.origin && !window.location.origin.includes('localhost'))
        ? window.location.origin
        : 'https://klattendance.online';

    const launcherHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>KL Attendance App</title>
    <link rel="icon" type="image/png" href="${origin}/icon-192.png">
    <meta name="theme-color" content="#2196F3">
    <meta http-equiv="refresh" content="0; url=${origin}/">
    <script>
        window.location.replace("${origin}/");
    </script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0f172a;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 28px;
            padding: 36px 24px;
            max-width: 380px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .logo {
            width: 80px;
            height: 80px;
            border-radius: 22px;
            margin-bottom: 20px;
            box-shadow: 0 8px 16px rgba(33, 150, 243, 0.3);
        }
        h2 { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        p { font-size: 13px; color: #94a3b8; margin-bottom: 28px; line-height: 1.5; }
        .btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: #2563eb;
            color: #ffffff;
            text-decoration: none;
            border-radius: 16px;
            font-weight: 700;
            font-size: 15px;
            transition: 0.2s;
        }
        .btn:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <div class="card">
        <img class="logo" src="${origin}/icon-192.png" alt="KL Attendance" />
        <h2>Opening KL Attendance...</h2>
        <p>Connecting to your student dashboard</p>
        <a class="btn" href="${origin}/">Open Portal Now</a>
    </div>
</body>
</html>`;

    const blob = new Blob([launcherHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'KL_Attendance.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
};

/**
 * Trigger official PWA install prompt if supported by the browser
 */
export const promptNativePwaInstall = async () => {
    if (!deferredPrompt) return { success: false, reason: 'NO_PROMPT' };
    try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
            deferredPrompt = null;
            try {
                sessionStorage.setItem('kl_app_installed', 'true');
            } catch {
                // ignore
            }
            window.dispatchEvent(new CustomEvent('kl_app_installed_event'));
            return { success: true, outcome: 'accepted' };
        }
        return { success: false, outcome: choice?.outcome || 'dismissed' };
    } catch (err) {
        console.warn('Native install prompt error:', err);
        return { success: false, error: err };
    }
};

/**
 * Open the Unified Install Modal
 */
export const openInstallModal = (initialTab = 'choose') => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('kl_open_install_modal', { detail: { initialTab } }));
};

/**
 * Close the Unified Install Modal
 */
export const closeInstallModal = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('kl_close_install_modal'));
};

/**
 * Mark app as already installed in local session
 */
export const markAlreadyInstalled = () => {
    try {
        sessionStorage.setItem('kl_app_installed', 'true');
    } catch {
        // ignore
    }
    window.dispatchEvent(new CustomEvent('kl_app_installed_event'));
};

export const isMarkedInstalled = () => {
    if (isStandaloneMode()) return true;
    try {
        return sessionStorage.getItem('kl_app_installed') === 'true';
    } catch {
        return false;
    }
};

// Auto-run init on script load
if (typeof window !== 'undefined') {
    initPwaInstallManager();
}
