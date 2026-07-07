(async () => {
  function isFrenchPage() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('fr');
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

  function renderCourses(coursesPayload) {
    const root = document.getElementById('coursesRoot');
    const menuRoot = document.getElementById('coursesMenu');
    if (!root || !menuRoot || typeof Handlebars === 'undefined') {
      return;
    }

    const locale = isFrenchPage() ? 'fr' : 'en';
    const allCourses = coursesPayload?.courses || {};
    const courses = Array.isArray(allCourses[locale]) ? allCourses[locale] : [];

    const templateSource = document.getElementById('courses-template')?.innerHTML || '';
    const menuTemplateSource = document.getElementById('courses-menu-template')?.innerHTML || '';
    if (!templateSource || !menuTemplateSource) {
      return;
    }

    const template = Handlebars.compile(templateSource);
    const menuTemplate = Handlebars.compile(menuTemplateSource);
    const ui = {
      ctaLabel: locale === 'fr' ? 'En savoir plus' : 'Learn more',
      emptyLabel:
        locale === 'fr'
          ? 'Aucune formation disponible pour le moment.'
          : 'No courses available at the moment.',
      menuEmptyLabel:
        locale === 'fr'
          ? 'Aucune formation disponible pour le moment.'
          : 'No courses available at the moment.'
    };

    const normalizedCourses = courses.map((course) => ({
      ...course,
      color: normalizeHexColor(course.color),
      anchorId: `course-${String(course.id || '')}`.replace(/[^a-zA-Z0-9_-]/g, '-')
    }));

    const context = {
      courses: normalizedCourses,
      ui,
      hasCourses: normalizedCourses.length > 0
    };

    menuRoot.innerHTML = menuTemplate(context);
    root.innerHTML = template(context);

    root.querySelectorAll('.courses-card').forEach((card) => {
      const color = normalizeHexColor(card.getAttribute('data-color'));
      card.style.borderTop = `4px solid ${color}`;
    });

    root.querySelectorAll('.courses-cta').forEach((button) => {
      const color = normalizeHexColor(button.getAttribute('data-color'));
      button.style.backgroundColor = color;
    });

    menuRoot.querySelectorAll('.courses-menu-btn').forEach((button) => {
      const color = normalizeHexColor(button.getAttribute('data-color'));
      button.style.backgroundColor = color;
    });
  }

  try {
    const coursesDataUrl = typeof window.appPath === 'function' ? window.appPath('/data/courses.json') : '/data/courses.json';
    const response = await fetch(coursesDataUrl);
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    renderCourses(payload);
  } catch (_error) {
    // Keep the page usable if courses data is unavailable.
  }
})();
