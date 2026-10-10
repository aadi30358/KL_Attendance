/**
 * Developer Console Portfolio & Social Links Easter Egg
 * Displays portfolio, socials, and interactive helper commands in the browser console.
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

export const printConsolePortfolio = () => {
    const portfolioUrl = getPortfolioUrl();

    const titleStyle = 'background: linear-gradient(90deg, #4f46e5, #7c3aed, #db2777); color: white; padding: 6px 12px; border-radius: 8px; font-weight: 900; font-size: 13px; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);';
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
    if (typeof window === 'undefined') return;

    // Define interactive console functions
    window.portfolio = () => {
        const url = getPortfolioUrl();
        window.open(url, '_blank');
        return `Opening Portfolio: ${url}`;
    };

    window.github = () => {
        window.open(GITHUB_URL, '_blank');
        return `Opening GitHub: ${GITHUB_URL}`;
    };

    window.linkedin = () => {
        window.open(LINKEDIN_URL, '_blank');
        return `Opening LinkedIn: ${LINKEDIN_URL}`;
    };

    window.instagram = () => {
        window.open(INSTAGRAM_URL, '_blank');
        return `Opening Instagram: ${INSTAGRAM_URL}`;
    };

    window.links = () => {
        printConsolePortfolio();
        return 'All developer links printed above!';
    };

    // Print to console after window stabilizes
    const printTimer = setTimeout(() => {
        printConsolePortfolio();
    }, 1200);

    // DevTools open detection
    let devtoolsOpen = false;
    const checkDevTools = () => {
        const threshold = 160;
        const widthDiff = window.outerWidth - window.innerWidth > threshold;
        const heightDiff = window.outerHeight - window.innerHeight > threshold;
        if (widthDiff || heightDiff) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                printConsolePortfolio();
                // Attempt to auto-open portfolio on first DevTools inspection
                try {
                    const url = getPortfolioUrl();
                    const win = window.open(url, '_blank');
                    if (!win) {
                        console.log('%c[Notice] Popup blocked by browser policy. Click the portfolio link above or execute portfolio() in this console.', 'color: #fbbf24; font-size: 11px;');
                    }
                } catch {
                    // Browser pop-up blocker handled gracefully
                }
            }
        } else {
            devtoolsOpen = false;
        }
    };

    window.addEventListener('resize', checkDevTools, { passive: true });

    return () => {
        clearTimeout(printTimer);
        window.removeEventListener('resize', checkDevTools);
    };
};
