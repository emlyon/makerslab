(function () {
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

    window.APP_BASE_PATH = APP_BASE_PATH;
    window.appPath = appPath;
    window.stripAppBasePrefix = stripAppBasePrefix;

    window.include = function include(html) {
        document.open();
        document.write(html);
        document.close();
    };
})();
