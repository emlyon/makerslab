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
        chooseCategoryLabel: 'Choisissez une catégorie pour afficher les équipements.',
        noCategoriesLabel: 'Aucune catégorie disponible pour le moment.',
        noEquipmentLabel: 'Aucun équipement disponible pour cette catégorie.',
        noSearchResultsLabel: 'Aucun équipement ne correspond a votre recherche.',
        menuNoCategoriesLabel: 'Aucune catégorie disponible pour le moment.',
        allEquipmentLabel: 'Tous les équipements',
        searchPlaceholder: 'Rechercher un équipement',
        searchButtonLabel: 'Rechercher',
        ctaLabel: 'Voir l\'équipement'
      };
    }

    return {
      chooseCategoryLabel: 'Select a category to display equipment.',
      noCategoriesLabel: 'No categories available at the moment.',
      noEquipmentLabel: 'No equipment available for this category.',
      noSearchResultsLabel: 'No equipment matches your search.',
      menuNoCategoriesLabel: 'No categories available at the moment.',
      allEquipmentLabel: 'All equipment',
      searchPlaceholder: 'Search equipment',
      searchButtonLabel: 'Search',
      ctaLabel: 'View equipment'
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

  function renderEquipment(payload) {
    const categoriesRoots = Array.from(document.querySelectorAll('.equipment-categories-menu'));
    const searchRoot = document.getElementById('equipmentSearchRoot');
    const equipmentRoot = document.getElementById('equipmentRoot');
    if (
      categoriesRoots.length === 0 ||
      !equipmentRoot ||
      typeof Handlebars === 'undefined' ||
      typeof normalizeHexColor !== 'function' ||
      typeof applyDataColorStyles !== 'function' ||
      typeof equalizeCardHeightsByRow !== 'function'
    ) {
      return;
    }

    const locale = isFrenchPage() ? 'fr' : 'en';
    const languageData = payload?.equipment?.[locale] || {};
    const equipment = Array.isArray(languageData.equipment) ? languageData.equipment : [];
    const categories = Array.isArray(languageData.categories) ? languageData.categories : [];

    const categoriesTemplateSource = document.getElementById('equipment-categories-template')?.innerHTML || '';
    const equipmentTemplateSource = document.getElementById('equipment-template')?.innerHTML || '';
    if (!categoriesTemplateSource || !equipmentTemplateSource) {
      return;
    }

    const categoriesTemplate = Handlebars.compile(categoriesTemplateSource);
    const equipmentTemplate = Handlebars.compile(equipmentTemplateSource);
    const ui = buildUi(locale);

    const normalizedCategories = categories.map((category) => ({
      ...category,
      color: normalizeHexColor(category.color),
      anchorId: toAnchorId('category', category)
    }));
    const categoriesById = new Map(normalizedCategories.map((category) => [category.id, category]));
    const equipmentByCategoryId = new Map();
    const categoryColorById = new Map(normalizedCategories.map((category) => [category.id, category.color]));

    for (const category of normalizedCategories) {
      equipmentByCategoryId.set(category.id, []);
    }

    const normalizedEquipment = equipment.map((equipment) => ({
      ...equipment,
      anchorId: toAnchorId('equipment', equipment),
      type: String(equipment.type || '').trim(),
      places: Array.isArray(equipment.placeNames) ? equipment.placeNames : [],
      iconUrl: String(equipment.iconUrl || '').trim(),
      categories: [...new Set(
        (Array.isArray(equipment.categoryIds) ? equipment.categoryIds : [])
          .map((categoryId) => categoriesById.get(categoryId)?.name)
      )].filter(Boolean)
    }));
    const equipmentByAnchor = new Map(normalizedEquipment.map((equipment) => [equipment.anchorId, equipment]));
    const equipmentToPrimaryCategoryId = new Map();

    for (const equipment of normalizedEquipment) {
      const categoryIds = Array.isArray(equipment.categoryIds) ? equipment.categoryIds : [];
      const firstExistingCategoryId = categoryIds.find((categoryId) => equipmentByCategoryId.has(categoryId)) || null;
      if (firstExistingCategoryId) {
        equipmentToPrimaryCategoryId.set(equipment.id, firstExistingCategoryId);
      }
      for (const categoryId of categoryIds) {
        if (!equipmentByCategoryId.has(categoryId)) {
          continue;
        }

        equipmentByCategoryId.get(categoryId).push(equipment);
      }
    }

    // Filter categories to only include those with equipment
    const categoriesWithEquipment = normalizedCategories.filter((category) => {
      const categoryEquipment = equipmentByCategoryId.get(category.id) || [];
      return categoryEquipment.length > 0;
    });

    // Create category mapping for categories with equipment only
    const categoryIdByAnchor = new Map(categoriesWithEquipment.map((category) => [category.anchorId, category.id]));

    const equipmentWithCardColor = normalizedEquipment.map((equipment) => {
      const categoryIds = Array.isArray(equipment.categoryIds) ? equipment.categoryIds : [];
      const firstCategoryId = categoryIds.find((categoryId) => categoryColorById.has(categoryId));
      return {
        ...equipment,
        cardColor: firstCategoryId ? categoryColorById.get(firstCategoryId) : '#d32f2f'
      };
    });
    const equipmentWithCardColorById = new Map(equipmentWithCardColor.map((equipment) => [equipment.id, equipment]));

    const canUseFuse = typeof Fuse !== 'undefined';
    const fuse = canUseFuse ? new Fuse(equipmentWithCardColor, {
      includeScore: false,
      threshold: 0.35,
      ignoreLocation: true,
      keys: ['name', 'type', 'places', 'categories']
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
      } else if (equipmentByAnchor.has(hashAnchor)) {
        const equipment = equipmentByAnchor.get(hashAnchor);
        const categoryId = equipmentToPrimaryCategoryId.get(equipment.id);
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
        <form id="equipment-search-form" class="equipment-search-form" style="max-width: 720px; margin: 0 auto; display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap;">
          <input
            id="equipment-search-input"
            type="search"
            value="${escapeHtml(searchQuery)}"
            placeholder="${escapeHtml(ui.searchPlaceholder)}"
            style="background: rgba(255, 255, 255, 0.95); border-radius: 999px; border: 0; padding: 0 18px; height: 46px; width: min(100%, 520px); box-sizing: border-box;"
            aria-label="${escapeHtml(ui.searchPlaceholder)}"
          />
          <button
            id="equipment-search-button"
            type="button"
            class="btn waves-effect waves-light"
            style="display: ${showSearchButton ? 'inline-flex' : 'none'}; align-items: center;"
          >${escapeHtml(ui.searchButtonLabel)}</button>
        </form>
      `;

      const form = searchRoot.querySelector('#equipment-search-form');
      const input = searchRoot.querySelector('#equipment-search-input');
      const button = searchRoot.querySelector('#equipment-search-button');
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
        renderEquipmentCards({ animatedScroll: false });
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
        renderEquipmentCards({ animatedScroll: false });
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

    function getVisibleEquipment() {
      const selectedCategoryEquipment = selectedCategoryId
        ? (equipmentByCategoryId.get(selectedCategoryId) || []).map((equipment) => equipmentWithCardColorById.get(equipment.id)).filter(Boolean)
        : equipmentWithCardColor;

      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery || !fuse) {
        return selectedCategoryEquipment;
      }

      const selectedIds = new Set(selectedCategoryEquipment.map((equipment) => equipment.id));
      return fuse.search(trimmedQuery)
        .map((result) => result.item)
        .filter((equipment) => selectedIds.has(equipment.id));
    }

    function renderCategories() {
      for (const categoriesRoot of categoriesRoots) {
        categoriesRoot.innerHTML = categoriesTemplate({
          categories: categoriesWithEquipment,
          hasCategories: categoriesWithEquipment.length > 0,
          selectedCategoryId,
          ui
        });

        categoriesRoot.querySelectorAll('.equipment-category-btn').forEach((button) => {
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

        categoriesRoot.querySelectorAll('.equipment-category-btn').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            const nextCategoryId = button.getAttribute('data-category-id');
            selectedCategoryId = selectedCategoryId === nextCategoryId ? null : nextCategoryId;
            pendingScrollTargetId = (button.getAttribute('href') || '').replace(/^#/, '');
            renderCategories();
            renderEquipmentCards({ animatedScroll: true });
          });
        });
      }
    }

    function renderEquipmentCards({ animatedScroll = false } = {}) {
      const selectedCategory = selectedCategoryId ? categoriesById.get(selectedCategoryId) : null;
      const visibleEquipment = getVisibleEquipment();
      const headingLabel = selectedCategory ? selectedCategory.name : ui.allEquipmentLabel;
      const headingAnchorId = selectedCategory ? selectedCategory.anchorId : 'all-equipment';
      const noEquipmentMessage = searchQuery.trim() ? ui.noSearchResultsLabel : ui.noEquipmentLabel;

      equipmentRoot.innerHTML = equipmentTemplate({
        hasCategories: normalizedCategories.length > 0,
        selectedCategory,
        headingLabel,
        headingAnchorId,
        equipment: visibleEquipment,
        equipmentRows: chunkIntoRows(visibleEquipment, 3),
        hasEquipment: visibleEquipment.length > 0,
        noEquipmentMessage,
        ui
      });

      applyDataColorStyles(equipmentRoot, [
        {
          selector: '.flex-card',
          styleProperty: 'borderTop',
          styleValue: (color) => `4px solid ${color}`
        },
        { selector: '.equipment-cta', styleProperty: 'backgroundColor' }
      ]);
      equalizeCardHeightsByRow(equipmentRoot, { cardSelector: '.flex-card' });

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
    renderEquipmentCards();

    if (initialSearchParam) {
      focusSearchInput({ animatedScroll: true, selectText: false });
    }

    if (!hasResizeListener) {
      hasResizeListener = true;
      window.addEventListener('resize', () => {
        equalizeCardHeightsByRow(equipmentRoot, { cardSelector: '.flex-card' });
      });
    }
  }

  const equipmentDataUrl = typeof window.appPath === 'function' ? window.appPath('/data/equipment.json') : '/data/equipment.json';
  const categoriesDataUrl = typeof window.appPath === 'function' ? window.appPath('/data/categories.json') : '/data/categories.json';

  try {
    const [equipmentResponse, categoriesResponse] = await Promise.all([
      fetch(equipmentDataUrl),
      fetch(categoriesDataUrl)
    ]);

    if (!equipmentResponse.ok) {
      throw new Error(`Failed to fetch equipment data (${equipmentResponse.status}).`);
    }

    const equipmentPayload = await equipmentResponse.json();
    let categoriesPayload = {};

    if (categoriesResponse.ok) {
      categoriesPayload = await categoriesResponse.json();
    } else {
      console.warn(`[equipment] Failed to fetch categories data (${categoriesResponse.status}). Categories will be empty.`);
    }

    // Merge categories into equipment payload for rendering
    const locale = isFrenchPage() ? 'fr' : 'en';
    if (equipmentPayload.equipment && equipmentPayload.equipment[locale]) {
      equipmentPayload.equipment[locale].categories = Array.isArray(categoriesPayload.categories?.[locale])
        ? categoriesPayload.categories[locale]
        : [];
    }

    renderEquipment(equipmentPayload);
  } catch (error) {
    console.error(`[equipment] Failed to fetch data: ${error.message}`);
    renderEquipment({});
  }
})();
