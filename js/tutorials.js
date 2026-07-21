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

  function toAnchorId(prefix, record) {
    const slug = String(record?.slug || '').trim();
    if (slug) {
      return `${prefix}-${slug}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    return `${prefix}-${String(record?.id || '')}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function buildUi(locale) {
    if (locale === 'fr') {
      return {
        chooseCategoryLabel: 'Choisissez une catégorie pour afficher les tutoriels.',
        noCategoriesLabel: 'Aucune catégorie disponible pour le moment.',
        noTutorialsLabel: 'Aucun tutoriel disponible pour cette catégorie.',
        menuNoCategoriesLabel: 'Aucune catégorie disponible pour le moment.',
        ctaLabel: 'Voir le tutoriel'
      };
    }

    return {
      chooseCategoryLabel: 'Select a category to display tutorials.',
      noCategoriesLabel: 'No categories available at the moment.',
      noTutorialsLabel: 'No tutorials available for this category.',
      menuNoCategoriesLabel: 'No categories available at the moment.',
      ctaLabel: 'View tutorial'
    };
  }

  function renderTutorials(payload) {
    const categoriesRoot = document.getElementById('tutorialCategoriesMenu');
    const tutorialsRoot = document.getElementById('tutorialsRoot');
    if (!categoriesRoot || !tutorialsRoot || typeof Handlebars === 'undefined') {
      return;
    }

    const locale = isFrenchPage() ? 'fr' : 'en';
    const languageData = payload?.tutorials?.[locale] || {};
    const tutorials = Array.isArray(languageData.tutorials) ? languageData.tutorials : [];
    const machines = Array.isArray(languageData.machines) ? languageData.machines : [];
    const software = Array.isArray(languageData.software) ? languageData.software : [];
    const courses = Array.isArray(languageData.courses) ? languageData.courses : [];
    const categories = Array.isArray(languageData.categories) ? languageData.categories : [];
    const machineNameById = new Map(machines.map((machine) => [machine.id, machine.name]));
    const softwareNameById = new Map(software.map((softwareItem) => [softwareItem.id, softwareItem.name]));
    const courseNameById = new Map(courses.map((course) => [course.id, course.name]));

    const categoriesTemplateSource = document.getElementById('tutorial-categories-template')?.innerHTML || '';
    const tutorialsTemplateSource = document.getElementById('tutorials-template')?.innerHTML || '';
    if (!categoriesTemplateSource || !tutorialsTemplateSource) {
      return;
    }

    const categoriesTemplate = Handlebars.compile(categoriesTemplateSource);
    const tutorialsTemplate = Handlebars.compile(tutorialsTemplateSource);
    const ui = buildUi(locale);

    const normalizedCategories = categories.map((category) => ({
      ...category,
      color: normalizeHexColor(category.color),
      anchorId: toAnchorId('category', category)
    }));
    const categoriesById = new Map(normalizedCategories.map((category) => [category.id, category]));
    const categoryIdByAnchor = new Map(normalizedCategories.map((category) => [category.anchorId, category.id]));
    const tutorialsByCategoryId = new Map();

    for (const category of normalizedCategories) {
      tutorialsByCategoryId.set(category.id, []);
    }

    const normalizedTutorials = tutorials.map((tutorial) => ({
      ...tutorial,
      anchorId: toAnchorId('tutorial', tutorial),
      summary: String(tutorial.summary || '').trim(),
      machines: (Array.isArray(tutorial.machineIds) ? tutorial.machineIds : [])
        .map((machineId) => machineNameById.get(machineId))
        .filter(Boolean),
      software: (Array.isArray(tutorial.softwareIds) ? tutorial.softwareIds : [])
        .map((softwareId) => softwareNameById.get(softwareId))
        .filter(Boolean),
      courses: [...new Set([
        ...(Array.isArray(tutorial.courseNames) ? tutorial.courseNames : []),
        ...(Array.isArray(tutorial.courseIds) ? tutorial.courseIds.map((courseId) => courseNameById.get(courseId)) : [])
      ])].filter(Boolean)
    }));
    const tutorialByAnchor = new Map(normalizedTutorials.map((tutorial) => [tutorial.anchorId, tutorial]));
    const tutorialToPrimaryCategoryId = new Map();

    for (const tutorial of normalizedTutorials) {
      const categoryIds = Array.isArray(tutorial.categoryIds) ? tutorial.categoryIds : [];
      const firstExistingCategoryId = categoryIds.find((categoryId) => tutorialsByCategoryId.has(categoryId)) || null;
      if (firstExistingCategoryId) {
        tutorialToPrimaryCategoryId.set(tutorial.id, firstExistingCategoryId);
      }
      for (const categoryId of categoryIds) {
        if (!tutorialsByCategoryId.has(categoryId)) {
          continue;
        }

        tutorialsByCategoryId.get(categoryId).push(tutorial);
      }
    }

    let selectedCategoryId = null;
    const rawHash = String(window.location.hash || '').trim();
    const hashAnchor = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
    let pendingScrollTargetId = '';
    if (hashAnchor) {
      if (categoryIdByAnchor.has(hashAnchor)) {
        selectedCategoryId = categoryIdByAnchor.get(hashAnchor);
        pendingScrollTargetId = hashAnchor;
      } else if (tutorialByAnchor.has(hashAnchor)) {
        const tutorial = tutorialByAnchor.get(hashAnchor);
        const categoryId = tutorialToPrimaryCategoryId.get(tutorial.id);
        if (categoryId) {
          selectedCategoryId = categoryId;
          pendingScrollTargetId = hashAnchor;
        }
      }
    }

    function renderCategories() {
      categoriesRoot.innerHTML = categoriesTemplate({
        categories: normalizedCategories,
        hasCategories: normalizedCategories.length > 0,
        selectedCategoryId,
        ui
      });

      categoriesRoot.querySelectorAll('.tutorial-category-btn').forEach((button) => {
        const color = normalizeHexColor(button.getAttribute('data-color'));
        if (button.classList.contains('active')) {
          button.style.backgroundColor = color;
          button.style.color = '#fff';
          button.style.borderColor = color;
          return;
        }

        button.style.borderColor = color;
        button.style.color = color;
      });

      categoriesRoot.querySelectorAll('.tutorial-category-btn').forEach((button) => {
        button.addEventListener('click', () => {
          selectedCategoryId = button.getAttribute('data-category-id');
          renderCategories();
          renderTutorialCards();
        });
      });
    }

    function renderTutorialCards() {
      const selectedCategory = selectedCategoryId ? categoriesById.get(selectedCategoryId) : null;
      const categoryTutorials = selectedCategoryId ? tutorialsByCategoryId.get(selectedCategoryId) || [] : [];

      tutorialsRoot.innerHTML = tutorialsTemplate({
        hasCategories: normalizedCategories.length > 0,
        selectedCategory,
        tutorials: categoryTutorials,
        hasTutorials: categoryTutorials.length > 0,
        ui
      });

      tutorialsRoot.querySelectorAll('.tutorial-card').forEach((card) => {
        const color = normalizeHexColor(card.getAttribute('data-color'));
        card.style.borderTop = `4px solid ${color}`;
      });

      tutorialsRoot.querySelectorAll('.tutorial-cta').forEach((button) => {
        const color = normalizeHexColor(button.getAttribute('data-color'));
        button.style.backgroundColor = color;
      });

      if (pendingScrollTargetId) {
        const target = document.getElementById(pendingScrollTargetId);
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        pendingScrollTargetId = '';
      }
    }

    renderCategories();
    renderTutorialCards();
  }

  const tutorialsDataUrl = typeof window.appPath === 'function' ? window.appPath('/data/tutorials.json') : '/data/tutorials.json';

  try {
    const response = await fetch(tutorialsDataUrl);
    if (!response.ok) {
      console.error(`[tutorials] Failed to fetch tutorials data (${response.status}).`);
      renderTutorials({});
      return;
    }

    const payload = await response.json();
    renderTutorials(payload);
  } catch (error) {
    console.error(`[tutorials] Failed to fetch tutorials data: ${error.message}`);
    renderTutorials({});
  }
})();
