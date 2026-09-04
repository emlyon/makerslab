(async () => {
  const normalizeHexColor = window.normalizeHexColor;
  const applyDataColorStyles = window.applyDataColorStyles;
  const equalizeCardHeightsByRow = window.equalizeCardHeightsByRow;
  let hasResizeListener = false;

  function isFrenchPage() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('fr');
  }

  function toAnchorId(course) {
    const slug = String(course?.slug || '').trim();
    if (slug) {
      return slug.replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    return `course-${String(course?.id || '')}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function chunkIntoRows(items, rowSize = 3) {
    const rows = [];
    for (let index = 0; index < items.length; index += rowSize) {
      rows.push(items.slice(index, index + rowSize));
    }
    return rows;
  }

  function renderCourses(coursesPayload) {
    const root = document.getElementById('coursesRoot');
    const menuRoot = document.getElementById('coursesMenu');
    if (
      !root ||
      !menuRoot ||
      typeof Handlebars === 'undefined' ||
      typeof normalizeHexColor !== 'function' ||
      typeof applyDataColorStyles !== 'function' ||
      typeof equalizeCardHeightsByRow !== 'function'
    ) {
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
      anchorId: toAnchorId(course)
    }));

    const context = {
      courses: normalizedCourses,
      courseRows: chunkIntoRows(normalizedCourses, 3),
      ui,
      hasCourses: normalizedCourses.length > 0
    };

    menuRoot.innerHTML = menuTemplate(context);
    root.innerHTML = template(context);

    applyDataColorStyles(root, [
      {
        selector: '.flex-card',
        styleProperty: 'borderTop',
        styleValue: (color) => `4px solid ${color}`
      },
      { selector: '.courses-cta', styleProperty: 'backgroundColor' }
    ]);

    applyDataColorStyles(menuRoot, [{ selector: '.courses-menu-btn', styleProperty: 'backgroundColor' }]);
    equalizeCardHeightsByRow(root, { cardSelector: '.flex-card' });

    if (!hasResizeListener) {
      hasResizeListener = true;
      window.addEventListener('resize', () => {
        equalizeCardHeightsByRow(root, { cardSelector: '.flex-card' });
      });
    }
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
