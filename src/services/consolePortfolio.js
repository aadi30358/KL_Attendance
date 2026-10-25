/**
 * Developer Console Portfolio & Social Links Easter Egg
 * Displays developer info, socials, and interactive helper commands in the browser console.
 * Strictly isolates console to display developer info only, silencing all other data logs.
 */

import { lockConsole } from '../utils/securityShield';

const DEFAULT_PORTFOLIO = 'https://garlapatiyaswanthadithya.web.app/';
const GITHUB_URL = 'https://github.com/aadi30358';
const LINKEDIN_URL = 'https://www.linkedin.com/in/garlapati-yaswanth-adithya-reddy-226108367';
const INSTAGRAM_URL = 'https://www.instagram.com/adithyareddy.7/';
const TELEGRAM_URL = 'https://t.me/kl2400030358';

// Unmuted native logger preserved before console is locked down
const nativeLog = typeof window !== 'undefined' && window.console && window.console.log
    ? window.console.log.bind(window.console)
    : () => {};

let inMemoryPortfolioUrl = DEFAULT_PORTFOLIO;

export const getPortfolioUrl = () => {
    return inMemoryPortfolioUrl || DEFAULT_PORTFOLIO;
};

export const setPortfolioUrl = (url) => {
    if (url) {
        inMemoryPortfolioUrl = url.trim();
    }
};

let hasPrintedConsole = false;
let lastOpenTime = 0;

export const triggerPortfolioLaunch = () => {
    const now = Date.now();
    if (now - lastOpenTime < 6000) return; // 6s debounce
    lastOpenTime = now;

    try {
        const url = getPortfolioUrl();
        window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
        // handled
    }

    // Dispatch modal asking for Instagram, LinkedIn, GitHub, Telegram
    try {
        window.dispatchEvent(new CustomEvent('kl_open_dev_modal', {
            detail: { openedPortfolio: true }
        }));
    } catch {
        // ignore
    }
};

/**
 * Prints the exact requested Developer Info banner in Console
 * Formatted with separate lines so each link is clean, visible, and clickable.
 * Immediately locks down console afterwards so ZERO student data, courses, or tokens can be leaked.
 */
export const printConsolePortfolio = (force = false) => {
    if (hasPrintedConsole && !force) return;
    hasPrintedConsole = true;

    const portfolioUrl = getPortfolioUrl();

    const titleStyle = 'background: linear-gradient(90deg, #4f46e5, #7c3aed, #db2777); color: white; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 13px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);';
    const labelStyle = 'color: #38bdf8; font-weight: 700; font-size: 12px;';
    const valueStyle = 'color: #f1f5f9; font-weight: 600; font-size: 12px;';
    const linkStyle = 'color: #f472b6; text-decoration: underline; font-weight: 700; font-size: 12px;';
    const tipStyle = 'color: #34d399; font-style: italic; font-size: 11px;';
    const commandBadge = 'background: #1e1b4b; color: #a5b4fc; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-family: monospace; font-size: 11px;';

    nativeLog(
        '%c🛡️ KL SECURITY SHIELD — ACTIVE PROTECTION',
        'background: #0f172a; color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; border: 1px solid #1e293b;'
    );
    nativeLog('%c🚀 KL Attendance Calculator — Developer Info', titleStyle);
    nativeLog('%c👨‍💻 Developer : %cYaswanth Adithya Reddy', labelStyle, valueStyle);
    nativeLog('%c🌐 Portfolio : %c' + portfolioUrl, labelStyle, linkStyle);
    nativeLog('%c🐙 GitHub    : %c' + GITHUB_URL, labelStyle, linkStyle);
    nativeLog('%c💼 LinkedIn  : %c' + LINKEDIN_URL, labelStyle, linkStyle);
    nativeLog('%c📸 Instagram : %c' + INSTAGRAM_URL, labelStyle, linkStyle);
    nativeLog('%c✈️ Telegram  : %c' + TELEGRAM_URL, labelStyle, linkStyle);
    nativeLog('');
    nativeLog('%c💡 Commands: Type %cportfolio()%c, %cinstagram()%c, %clinkedin()%c, %cgithub()%c, or %ctelegram()%c to open directly!', tipStyle, commandBadge, tipStyle, commandBadge, tipStyle, commandBadge, tipStyle, commandBadge, tipStyle, commandBadge, tipStyle);

    // Mute and lock down all future console calls across the entire application
    lockConsole();
};

let isPortfolioInitialized = false;

export const initConsolePortfolio = () => {
    if (typeof window === 'undefined') return () => {};
    if (isPortfolioInitialized) return () => {};
    isPortfolioInitialized = true;

    // Helper commands object
    const commands = {
        portfolio: () => {
            const url = getPortfolioUrl();
            window.open(url, '_blank', 'noopener,noreferrer');
            return `Opening Portfolio: ${url}`;
        },
        github: () => {
            window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
            return `Opening GitHub: ${GITHUB_URL}`;
        },
        linkedin: () => {
            window.open(LINKEDIN_URL, '_blank', 'noopener,noreferrer');
            return `Opening LinkedIn: ${LINKEDIN_URL}`;
        },
        instagram: () => {
            window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer');
            return `Opening Instagram: ${INSTAGRAM_URL}`;
        },
        telegram: () => {
            window.open(TELEGRAM_URL, '_blank', 'noopener,noreferrer');
            return `Opening Telegram: ${TELEGRAM_URL}`;
        },
        links: () => {
            printConsolePortfolio(true);
            return 'All developer links printed above!';
        }
    };

    // Safely bind commands without causing read-only property conflicts
    Object.entries(commands).forEach(([name, fn]) => {
        try {
            Object.defineProperty(window, name, {
                value: fn,
                writable: true,
                configurable: true,
                enumerable: true
            });
        } catch {
            try {
                window[name] = fn;
            } catch {
                // ignore
            }
        }
    });

    // Print developer info banner once on mount
    printConsolePortfolio(false);

    // Keydown handler for F12 and Inspect shortcuts (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
    const handleKeydown = (e) => {
        const isF12 = e.key === 'F12';
        const isInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c');

        if (isF12 || isInspect) {
            triggerPortfolioLaunch();
        }
    };

    window.addEventListener('keydown', handleKeydown);

    // Detect DevTools opening (e.g. via right-click Inspect)
    let devtoolsOpen = false;
    const checkDevTools = () => {
        const threshold = 160;
        const widthDiff = window.outerWidth - window.innerWidth > threshold;
        const heightDiff = window.outerHeight - window.innerHeight > threshold;
        if (widthDiff || heightDiff) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                triggerPortfolioLaunch();
            }
        } else {
            devtoolsOpen = false;
        }
    };

    window.addEventListener('resize', checkDevTools, { passive: true });

    return () => {
        window.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('resize', checkDevTools);
    };
};
