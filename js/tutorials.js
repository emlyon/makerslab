(async () => {
  const normalizeHexColor = window.normalizeHexColor;
  const applyDataColorStyles = window.applyDataColorStyles;
  const equalizeCardHeightsByRow = window.equalizeCardHeightsByRow;
  let hasResizeListener = false;
  let hasSearchShortcutListener = false;

  function isFrenchPage() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('fr');
  }

  function toAnchorId(prefix, record) {
    const slug = String(record?.slug || '').trim();
    if (slug) {
      return `${prefix}-${slug}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    }

    return `${prefix}-${String(record?.id || '')}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  
  function chunkIntoRows(items, rowSize = 3) {
    const rows = [];
    for (let index = 0; index < items.length; index += rowSize) {
      rows.push(items.slice(index, index + rowSize));
    }
    return rows;
  }


  function buildUi(locale) {
    if (locale === 'fr') {
      return {
        chooseCategoryLabel: 'Choisissez une catégorie pour afficher les tutoriels.',
        noCategoriesLabel: 'Aucune catégorie disponible pour le moment.',
        noTutorialsLabel: 'Aucun tutoriel disponible pour cette catégorie.',
        noSearchResultsLabel: 'Aucun tutoriel ne correspond a votre recherche.',
        menuNoCategoriesLabel: 'Aucune catégorie disponible pour le moment.',
        allTutorialsLabel: 'Tous les tutoriels',
        searchPlaceholder: 'Rechercher un tutoriel',
        searchButtonLabel: 'Rechercher',
        ctaLabel: 'Voir le tutoriel'
      };
    }

    return {
      chooseCategoryLabel: 'Select a category to display tutorials.',
      noCategoriesLabel: 'No categories available at the moment.',
      noTutorialsLabel: 'No tutorials available for this category.',
      noSearchResultsLabel: 'No tutorials match your search.',
      menuNoCategoriesLabel: 'No categories available at the moment.',
      allTutorialsLabel: 'All tutorials',
      searchPlaceholder: 'Search tutorials',
      searchButtonLabel: 'Search',
      ctaLabel: 'View tutorial'
    };
  }

  function updateLocationHash(hash) {
    if (!hash || !hash.startsWith('#')) {
      return;
    }

    if (history && typeof history.pushState === 'function') {
      history.pushState(null, '', hash);
      return;
    }

    window.location.hash = hash;
  }

  function scrollToTarget(target, { animated = false } = {}) {
    if (!target) {
      return;
    }

    if (animated && window.jQuery && typeof window.jQuery.scrollTo === 'function') {
      window.jQuery(window).scrollTo(window.jQuery(target), 500, { offset: -150 });
      return;
    }

    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  function renderTutorials(payload) {
    const categoriesRoots = Array.from(document.querySelectorAll('.tutorial-categories-menu'));
    const searchRoot = document.getElementById('tutorialSearchRoot');
    const tutorialsRoot = document.getElementById('tutorialsRoot');
    if (
      categoriesRoots.length === 0 ||
      !tutorialsRoot ||
      typeof Handlebars === 'undefined' ||
      typeof normalizeHexColor !== 'function' ||
      typeof applyDataColorStyles !== 'function' ||
      typeof equalizeCardHeightsByRow !== 'function'
    ) {
      return;
    }

    const locale = isFrenchPage() ? 'fr' : 'en';
    const languageData = payload?.tutorials?.[locale] || {};
    const tutorials = Array.isArray(languageData.tutorials) ? languageData.tutorials : [];
    const equipment = Array.isArray(languageData.equipment) ? languageData.equipment : [];
    const software = Array.isArray(languageData.software) ? languageData.software : [];
    const courses = Array.isArray(languageData.courses) ? languageData.courses : [];
    const categories = Array.isArray(languageData.categories) ? languageData.categories : [];
    const equipmentNameById = new Map(equipment.map((equipment) => [equipment.id, equipment.name]));
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
    const categoryColorById = new Map(normalizedCategories.map((category) => [category.id, category.color]));

    for (const category of normalizedCategories) {
      tutorialsByCategoryId.set(category.id, []);
    }

    const normalizedTutorials = tutorials.map((tutorial) => ({
      ...tutorial,
      anchorId: toAnchorId('tutorial', tutorial),
      summary: String(tutorial.summary || '').trim(),
      equipment: (Array.isArray(tutorial.equipmentIds) ? tutorial.equipmentIds : [])
        .map((equipmentId) => equipmentNameById.get(equipmentId))
        .filter(Boolean),
      software: (Array.isArray(tutorial.softwareIds) ? tutorial.softwareIds : [])
        .map((softwareId) => softwareNameById.get(softwareId))
        .filter(Boolean),
      courses: [...new Set([
        ...(Array.isArray(tutorial.courseNames) ? tutorial.courseNames : []),
        ...(Array.isArray(tutorial.courseIds) ? tutorial.courseIds.map((courseId) => courseNameById.get(courseId)) : [])
      ])].filter(Boolean),
      categories: [...new Set(
        (Array.isArray(tutorial.categoryIds) ? tutorial.categoryIds : [])
          .map((categoryId) => categoriesById.get(categoryId)?.name)
      )].filter(Boolean)
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

    const tutorialsWithCardColor = normalizedTutorials.map((tutorial) => {
      const categoryIds = Array.isArray(tutorial.categoryIds) ? tutorial.categoryIds : [];
      const firstCategoryId = categoryIds.find((categoryId) => categoryColorById.has(categoryId));
      return {
        ...tutorial,
        cardColor: firstCategoryId ? categoryColorById.get(firstCategoryId) : '#d32f2f'
      };
    });
    const tutorialWithCardColorById = new Map(tutorialsWithCardColor.map((tutorial) => [tutorial.id, tutorial]));

    const canUseFuse = typeof Fuse !== 'undefined';
    const fuse = canUseFuse ? new Fuse(tutorialsWithCardColor, {
      includeScore: false,
      threshold: 0.35,
      ignoreLocation: true,
      keys: ['name', 'summary', 'equipment', 'software', 'courses', 'categories']
    }) : null;

    let selectedCategoryId = null;
    let searchQuery = '';
    let searchInputElement = null;
    const rawHash = String(window.location.hash || '').trim();
    const hashAnchor = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
    let pendingScrollTargetId = '';
    const currentUrl = new URL(window.location.href);
    const initialSearchParam = String(currentUrl.searchParams.get('search') || '').trim();
    if (initialSearchParam) {
      searchQuery = initialSearchParam;
    }
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

    if (searchQuery) {
      selectedCategoryId = null;
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getNavbarOffset() {
      const navbar = document.querySelector('nav');
      if (!navbar) {
        return 80;
      }

      return Math.ceil(navbar.getBoundingClientRect().height) + 8;
    }

    function scrollSearchBarIntoView({ animated = true } = {}) {
      if (!searchRoot) {
        return;
      }

      const offset = getNavbarOffset();
      if (animated && window.jQuery && typeof window.jQuery.scrollTo === 'function') {
        window.jQuery(window).scrollTo(window.jQuery(searchRoot), 500, { offset: -offset });
        return;
      }

      const targetTop = searchRoot.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: animated ? 'smooth' : 'auto' });
    }

    function focusSearchInput({ animatedScroll = true, selectText = false } = {}) {
      if (!searchInputElement) {
        return;
      }

      scrollSearchBarIntoView({ animated: animatedScroll });
      searchInputElement.focus();
      if (selectText && typeof searchInputElement.select === 'function') {
        searchInputElement.select();
      }
    }

    function updateSearchParamInUrl() {
      const nextUrl = new URL(window.location.href);
      const trimmedQuery = String(searchQuery || '').trim();

      if (trimmedQuery) {
        nextUrl.searchParams.set('search', trimmedQuery);
      } else {
        nextUrl.searchParams.delete('search');
      }

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (history && typeof history.replaceState === 'function') {
        history.replaceState(null, '', nextPath);
      }
    }

    function renderSearchBar() {
      if (!searchRoot) {
        return;
      }

      const trimmedQuery = searchQuery.trim();
      const showSearchButton = trimmedQuery.length > 0;

      searchRoot.innerHTML = `
        <form id="tutorial-search-form" class="tutorial-search-form" style="max-width: 720px; margin: 0 auto; display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap;">
          <input
            id="tutorial-search-input"
            type="search"
            value="${escapeHtml(searchQuery)}"
            placeholder="${escapeHtml(ui.searchPlaceholder)}"
            style="background: rgba(255, 255, 255, 0.95); border-radius: 999px; border: 0; padding: 0 18px; height: 46px; width: min(100%, 520px); box-sizing: border-box;"
            aria-label="${escapeHtml(ui.searchPlaceholder)}"
          />
          <button
            id="tutorial-search-button"
            type="button"
            class="btn waves-effect waves-light"
            style="display: ${showSearchButton ? 'inline-flex' : 'none'}; align-items: center;"
          >${escapeHtml(ui.searchButtonLabel)}</button>
        </form>
      `;

      const form = searchRoot.querySelector('#tutorial-search-form');
      const input = searchRoot.querySelector('#tutorial-search-input');
      const button = searchRoot.querySelector('#tutorial-search-button');
      if (!form || !input || !button) {
        return;
      }
      searchInputElement = input;

      input.addEventListener('keyup', () => {
        searchQuery = input.value;
        if (searchQuery.trim()) {
          selectedCategoryId = null;
        }
        button.style.display = searchQuery.trim().length > 0 ? 'inline-flex' : 'none';
        updateSearchParamInUrl();
        renderCategories();
        renderTutorialCards({ animatedScroll: false });
      });

      input.addEventListener('focus', () => {
        scrollSearchBarIntoView({ animated: true });
      });

      input.addEventListener('click', () => {
        scrollSearchBarIntoView({ animated: true });
      });

      button.addEventListener('click', () => {
        searchQuery = input.value;
        if (searchQuery.trim()) {
          selectedCategoryId = null;
        }
        updateSearchParamInUrl();
        renderCategories();
        renderTutorialCards({ animatedScroll: false });
      });

      // Keep Enter from submitting the form; search is updated live on keyup.
      form.addEventListener('submit', (event) => {
        event.preventDefault();
      });

      if (!hasSearchShortcutListener) {
        hasSearchShortcutListener = true;
        window.addEventListener('keydown', (event) => {
          if ((event.metaKey || event.ctrlKey) && String(event.key || '').toLowerCase() === 'f') {
            event.preventDefault();
            focusSearchInput({ animatedScroll: true, selectText: true });
          }
        });
      }
    }

    function getVisibleTutorials() {
      const selectedCategoryTutorials = selectedCategoryId
        ? (tutorialsByCategoryId.get(selectedCategoryId) || []).map((tutorial) => tutorialWithCardColorById.get(tutorial.id)).filter(Boolean)
        : tutorialsWithCardColor;

      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery || !fuse) {
        return selectedCategoryTutorials;
      }

      const selectedIds = new Set(selectedCategoryTutorials.map((tutorial) => tutorial.id));
      return fuse.search(trimmedQuery)
        .map((result) => result.item)
        .filter((tutorial) => selectedIds.has(tutorial.id));
    }

    function renderCategories() {
      for (const categoriesRoot of categoriesRoots) {
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
          button.addEventListener('click', (event) => {
            event.preventDefault();
            const nextCategoryId = button.getAttribute('data-category-id');
            selectedCategoryId = selectedCategoryId === nextCategoryId ? null : nextCategoryId;
            pendingScrollTargetId = (button.getAttribute('href') || '').replace(/^#/, '');
            renderCategories();
            renderTutorialCards({ animatedScroll: true });
          });
        });
      }
    }

    function renderTutorialCards({ animatedScroll = false } = {}) {
      const selectedCategory = selectedCategoryId ? categoriesById.get(selectedCategoryId) : null;
      const visibleTutorials = getVisibleTutorials();
      const headingLabel = selectedCategory ? selectedCategory.name : ui.allTutorialsLabel;
      const headingAnchorId = selectedCategory ? selectedCategory.anchorId : 'all-tutorials';
      const noTutorialsMessage = searchQuery.trim() ? ui.noSearchResultsLabel : ui.noTutorialsLabel;

      tutorialsRoot.innerHTML = tutorialsTemplate({
        hasCategories: normalizedCategories.length > 0,
        selectedCategory,
        headingLabel,
        headingAnchorId,
        tutorials: visibleTutorials,
        tutorialRows: chunkIntoRows(visibleTutorials, 3),
        hasTutorials: visibleTutorials.length > 0,
        noTutorialsMessage,
        ui
      });

      applyDataColorStyles(tutorialsRoot, [
        {
          selector: '.flex-card',
          styleProperty: 'borderTop',
          styleValue: (color) => `4px solid ${color}`
        },
        { selector: '.tutorial-cta', styleProperty: 'backgroundColor' }
      ]);
      equalizeCardHeightsByRow(tutorialsRoot, { cardSelector: '.flex-card' });

      if (pendingScrollTargetId) {
        const target = document.getElementById(pendingScrollTargetId);
        if (target) {
          scrollToTarget(target, { animated: animatedScroll });
          updateLocationHash(`#${pendingScrollTargetId}`);
        }
        pendingScrollTargetId = '';
      }
    }

    renderCategories();
    renderSearchBar();
    renderTutorialCards();

    if (initialSearchParam) {
      focusSearchInput({ animatedScroll: true, selectText: false });
    }

    if (!hasResizeListener) {
      hasResizeListener = true;
      window.addEventListener('resize', () => {
        equalizeCardHeightsByRow(tutorialsRoot, { cardSelector: '.flex-card' });
      });
    }
  }

  const tutorialsDataUrl = typeof window.appPath === 'function' ? window.appPath('/data/tutorials.json') : '/data/tutorials.json';
  const categoriesDataUrl = typeof window.appPath === 'function' ? window.appPath('/data/categories.json') : '/data/categories.json';

  try {
    const [tutorialsResponse, categoriesResponse] = await Promise.all([
      fetch(tutorialsDataUrl),
      fetch(categoriesDataUrl)
    ]);

    if (!tutorialsResponse.ok) {
      throw new Error(`Failed to fetch tutorials data (${tutorialsResponse.status}).`);
    }

    const tutorialsPayload = await tutorialsResponse.json();
    let categoriesPayload = {};

    if (categoriesResponse.ok) {
      categoriesPayload = await categoriesResponse.json();
    } else {
      console.warn(`[tutorials] Failed to fetch categories data (${categoriesResponse.status}). Categories will be empty.`);
    }

    // Merge categories into tutorials payload for rendering
    const locale = isFrenchPage() ? 'fr' : 'en';
    if (tutorialsPayload.tutorials && tutorialsPayload.tutorials[locale]) {
      tutorialsPayload.tutorials[locale].categories = Array.isArray(categoriesPayload.categories?.[locale])
        ? categoriesPayload.categories[locale]
        : [];
    }

    renderTutorials(tutorialsPayload);
  } catch (error) {
    console.error(`[tutorials] Failed to fetch data: ${error.message}`);
    renderTutorials({});
  }
})();
