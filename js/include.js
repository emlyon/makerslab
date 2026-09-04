(function () {
    const LANGUAGE_PAGE_MAP = {
        en: {
            '/fr/': '/',
            '/fr/index.html': '/',
            '/fr/tutoriels.html': '/tutorials.html',
            '/fr/evenements.html': '/events.html',
            '/fr/equipements.html': '/equipment.html',
            '/fr/formations.html': '/courses.html'
        },
        fr: {
            '/': '/fr/',
            '/index.html': '/fr/',
            '/tutorials.html': '/fr/tutoriels.html',
            '/events.html': '/fr/evenements.html',
            '/equipment.html': '/fr/equipements.html',
            '/courses.html': '/fr/formations.html'
        }
    };

    function normalizeBasePath(value) {
        const raw = String(value || '').trim();
        if (!raw || raw === '/') {
            return '';
        }

        const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
        return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
    }

    function detectBasePath() {
        if (typeof window.__APP_BASE_PATH__ === 'string') {
            return normalizeBasePath(window.__APP_BASE_PATH__);
        }

        const host = String(window.location.hostname || '').toLowerCase();
        const firstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
        const isGithubPagesHost = host.endsWith('.github.io');

        if (isGithubPagesHost && firstSegment) {
            return `/${firstSegment}`;
        }

        return '';
    }

    const APP_BASE_PATH = detectBasePath();

    function appPath(value) {
        const input = String(value || '').trim();
        if (!input) {
            return APP_BASE_PATH || '/';
        }

        if (
            /^(?:[a-z]+:)?\/\//i.test(input) ||
            input.startsWith('#') ||
            input.startsWith('mailto:') ||
            input.startsWith('tel:')
        ) {
            return input;
        }

        if (input === '.' || input === './') {
            return APP_BASE_PATH ? `${APP_BASE_PATH}/` : '/';
        }

        let normalized = input.replace(/^\.\//, '/');
        if (!normalized.startsWith('/')) {
            normalized = `/${normalized}`;
        }

        if (normalized === '/') {
            return APP_BASE_PATH ? `${APP_BASE_PATH}/` : '/';
        }

        return `${APP_BASE_PATH}${normalized}`;
    }

    function stripAppBasePrefix(pathname) {
        const raw = pathname || window.location.pathname || '/';
        if (!APP_BASE_PATH) {
            return raw;
        }

        if (raw === APP_BASE_PATH) {
            return '/';
        }

        if (raw.startsWith(`${APP_BASE_PATH}/`)) {
            return raw.slice(APP_BASE_PATH.length);
        }

        return raw;
    }

    function currentLanguagePath() {
        const rawPath = stripAppBasePrefix(window.location.pathname || '/');

        if (rawPath === '/index.html') {
            return '/';
        }

        if (rawPath === '/fr') {
            return '/fr/';
        }

        return rawPath;
    }

    function currentLanguage() {
        const path = currentLanguagePath();
        return path.startsWith('/fr/') || path === '/fr/' || path === '/fr' ? 'fr' : 'en';
    }

    function languagePath(targetLanguage) {
        const normalizedLanguage = targetLanguage === 'fr' ? 'fr' : 'en';
        const pathname = currentLanguagePath();
        const sourceLanguage = currentLanguage();
        if (normalizedLanguage === sourceLanguage) {
            return appPath(pathname);
        }

        const mappedPath = LANGUAGE_PAGE_MAP[normalizedLanguage][pathname];

        if (mappedPath) {
            return appPath(mappedPath);
        }

        return appPath(normalizedLanguage === 'fr' ? '/fr/' : '/');
    }

    function normalizeHexColor(value, fallback = '#e2001a') {
        const raw = String(value || '').trim();
        if (!raw) {
            return fallback;
        }

        const prefixed = raw.startsWith('#') ? raw : `#${raw}`;
        const shortHex = /^#([0-9a-fA-F]{3})$/.exec(prefixed);
        if (shortHex) {
            const [r, g, b] = shortHex[1].split('');
            return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
        }

        if (/^#[0-9a-fA-F]{6}$/.test(prefixed)) {
            return prefixed.toLowerCase();
        }

        return fallback;
    }

    function applyDataColorStyles(root, rules) {
        if (!root || !Array.isArray(rules)) {
            return;
        }

        for (const rule of rules) {
            if (!rule || !rule.selector || !rule.styleProperty) {
                continue;
            }

            root.querySelectorAll(rule.selector).forEach((element) => {
                const color = normalizeHexColor(element.getAttribute('data-color'));
                const styleValue =
                    typeof rule.styleValue === 'function' ? rule.styleValue(color, element) : color;
                element.style[rule.styleProperty] = styleValue;
            });
        }
    }

    function equalizeCardHeightsByRow(root, options = {}) {
        if (!root) {
            return;
        }

        const rowSelector = options.rowSelector || '.row';
        const cardSelector = options.cardSelector || '.flex-card';
        const rows = root.querySelectorAll(rowSelector);

        rows.forEach((row) => {
            const cards = row.querySelectorAll(cardSelector);
            if (!cards.length) {
                return;
            }

            cards.forEach((card) => {
                card.style.minHeight = '';
            });

            const maxHeight = Math.max(...Array.from(cards).map((card) => card.offsetHeight));
            if (!Number.isFinite(maxHeight) || maxHeight <= 0) {
                return;
            }

            cards.forEach((card) => {
                card.style.minHeight = `${maxHeight}px`;
            });
        });
    }

    window.APP_BASE_PATH = APP_BASE_PATH;
    window.appPath = appPath;
    window.stripAppBasePrefix = stripAppBasePrefix;
    window.languagePath = languagePath;
    window.normalizeHexColor = normalizeHexColor;
    window.applyDataColorStyles = applyDataColorStyles;
    window.equalizeCardHeightsByRow = equalizeCardHeightsByRow;

    window.include = function include(html) {
        document.open();
        document.write(html);
        document.close();
    };

    // Register Handlebars helpers for template rendering
    if (typeof Handlebars !== 'undefined') {
        Handlebars.registerHelper('appPath', (value) => {
            return appPath(value);
        });
    }
})();
