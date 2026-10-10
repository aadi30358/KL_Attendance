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
 * Automatically download the Windows / Desktop Internet Shortcut (.url)
 * Works immediately on PC / Laptop with zero configuration
 */
export const downloadDesktopLauncher = () => {
    if (typeof window === 'undefined') return;

    const origin = (window.location.origin && !window.location.origin.includes('localhost'))
        ? window.location.origin
        : 'https://klattendance.online';

    const shortcutContent = [
        '[InternetShortcut]',
        `URL=${origin}/`,
        'IconIndex=0',
        `IconFile=${origin}/icon-192.png`,
        'HotKey=0',
        '[{000214A0-0000-0000-C000-000000000046}]',
        'Prop3=19,11',
        '[Metadata]',
        'Name=KL Attendance'
    ].join('\r\n');

    const blob = new Blob([shortcutContent], { type: 'application/internet-shortcut;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'KL_Attendance.url';
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
