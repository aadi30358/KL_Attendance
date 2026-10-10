/**
 * Developer Console Portfolio & Social Links Easter Egg
 * Displays developer info, socials, and interactive helper commands in the browser console.
 * Strictly prints once per session to keep console clean and fast.
 */

const DEFAULT_PORTFOLIO = 'https://garlapatiyaswanthadithya.web.app/';
const GITHUB_URL = 'https://github.com/aadi30358';
const LINKEDIN_URL = 'https://www.linkedin.com/in/garlapati-yaswanth-adithya-reddy-226108367';
const INSTAGRAM_URL = 'https://www.instagram.com/adithyareddy.7/';
const TELEGRAM_URL = 'https://t.me/kl2400030358';

export const getPortfolioUrl = () => {
    try {
        return localStorage.getItem('developer_portfolio_url') || DEFAULT_PORTFOLIO;
    } catch {
        return DEFAULT_PORTFOLIO;
    }
};

export const setPortfolioUrl = (url) => {
    try {
        if (url) {
            localStorage.setItem('developer_portfolio_url', url.trim());
        }
    } catch {
        // ignore
    }
};

// Singleton guard so developer info prints strictly once per session
let hasPrintedConsole = false;

/**
 * Prints the exact requested Developer Info banner in Console
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

    console.log('%c🚀 KL Attendance Calculator — Developer Info', titleStyle);
    console.log(
        `%c👨‍💻 Developer : %cYaswanth Adithya Reddy\n` +
        `%c🌐 Portfolio : %c${portfolioUrl}\n` +
        `%c🐙 GitHub    : %c${GITHUB_URL}\n` +
        `%c💼 LinkedIn  : %c${LINKEDIN_URL}\n` +
        `%c📸 Instagram : %c${INSTAGRAM_URL}\n` +
        `%c✈️ Telegram  : %c${TELEGRAM_URL}\n\n` +
        `%c💡 Commands: Type %cportfolio()%c or click any link above to open directly!`,
        labelStyle, valueStyle,
        labelStyle, linkStyle,
        labelStyle, linkStyle,
        labelStyle, linkStyle,
        labelStyle, linkStyle,
        labelStyle, linkStyle,
        tipStyle, commandBadge, tipStyle
    );
};

export const initConsolePortfolio = () => {
    if (typeof window === 'undefined') return () => {};

    // Expose interactive console functions for direct execution in DevTools
    window.portfolio = () => {
        const url = getPortfolioUrl();
        window.open(url, '_blank', 'noopener,noreferrer');
        return `Opening Portfolio: ${url}`;
    };

    window.github = () => {
        window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
        return `Opening GitHub: ${GITHUB_URL}`;
    };

    window.linkedin = () => {
        window.open(LINKEDIN_URL, '_blank', 'noopener,noreferrer');
        return `Opening LinkedIn: ${LINKEDIN_URL}`;
    };

    window.instagram = () => {
        window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer');
        return `Opening Instagram: ${INSTAGRAM_URL}`;
    };

    window.telegram = () => {
        window.open(TELEGRAM_URL, '_blank', 'noopener,noreferrer');
        return `Opening Telegram: ${TELEGRAM_URL}`;
    };

    window.links = () => {
        printConsolePortfolio(true);
        return 'All developer links printed above!';
    };

    // Print strictly once on mount
    printConsolePortfolio(false);

    // F12 Keybinding Handler:
    // Opens portfolio directly in a new tab AND displays the selection modal for Instagram / LinkedIn / GitHub / Telegram
    const handleKeydown = (e) => {
        const isF12 = e.key === 'F12';
        const isInspect = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j');

        if (isF12 || isInspect) {
            // Attempt to directly open Portfolio
            let openedDirectly = false;
            try {
                const url = getPortfolioUrl();
                const win = window.open(url, '_blank', 'noopener,noreferrer');
                if (win) {
                    openedDirectly = true;
                }
            } catch {
                openedDirectly = false;
            }

            // Also open on-screen dialog asking for Instagram, LinkedIn, GitHub, or Telegram
            window.dispatchEvent(new CustomEvent('kl_open_dev_modal', {
                detail: { openedPortfolio: openedDirectly }
            }));
        }
    };

    window.addEventListener('keydown', handleKeydown);

    return () => {
        window.removeEventListener('keydown', handleKeydown);
    };
};
