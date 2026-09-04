#!/usr/bin/env node

const NotionDataMapper = require('./notion-data-mapper');

/**
 * Maps Notion pages to Tutorial entities
 */
class TutorialMapper extends NotionDataMapper {
  mapPage(page, language) {
    const properties = page.properties || {};
    const nameProperty = this.findPropertyByAliases(properties, ['Name', 'name', 'nom', 'title', 'titre']) || 
                         this.findFirstPropertyByType(properties, 'title');
    const slugProperty = this.findPropertyByAliases(properties, ['slug']);
    const summaryProperty = this.findPropertyByAliases(properties, ['Summary', 'summary', 'Résumé', 'résumé']);
    const equipmentProperty = this.findPropertyByAliases(properties, ['Equipment', 'Equipements', 'equipements']);
    const categoriesProperty = this.findPropertyByAliases(properties, ['Categories', 'Catégories', 'catégories', 'categories']);
    const softwaresProperty = this.findPropertyByAliases(properties, ['Software', 'Logiciels', 'logiciels', 'software', 'softwares']);
    const coursesProperty = this.findPropertyByAliases(properties, ['Courses', 'cours', 'courses']);
    const statusProperty = this.findPropertyByAliases(properties, ['Status', 'status', 'statut']);

    const name = this.getPlainTextFromProperty(nameProperty);
    if (!name) {
      this.addWarning(`Skipped tutorial ${page.id}: missing name.`);
      return null;
    }

    if (!page.public_url) {
      this.addWarning(`Skipped tutorial ${page.id}: missing Notion page url.`);
      return null;
    }

    const coursesValue = this._getRelationAndMultiSelectValue(coursesProperty);
    const statusValue = this.getPlainTextFromProperty(statusProperty);
    // Treat null/empty status as published (unless explicitly "archived" or "unpublished")
    const isPublished = !statusValue || this.isPublishedStatus(statusValue);
    
    const equipmentIds = this.sortAndDedupe(this.getRelationIdsFromProperty(equipmentProperty));

    return {
      id: page.id,
      slug: this.normalizeSlug(this.getPlainTextFromProperty(slugProperty)),
      name,
      summary: this.getPlainTextFromProperty(summaryProperty),
      notionUrl: page.public_url,
      language: language,
      published: isPublished,
      equipmentIds: equipmentIds,
      categoryIds: this.sortAndDedupe(this.getRelationIdsFromProperty(categoriesProperty)),
      softwareIds: this.sortAndDedupe(this.getRelationIdsFromProperty(softwaresProperty)),
      courseIds: coursesValue.relationIds,
      courseNames: coursesValue.names,
      iconUrl: this.getPageIconUrl(page.icon)
    };
  }

  _getRelationAndMultiSelectValue(property) {
    if (!property) {
      return { relationIds: [], names: [] };
    }
    if (property.type === 'relation') {
      return { relationIds: this.sortAndDedupe(this.getRelationIdsFromProperty(property)), names: [] };
    }
    if (property.type === 'multi_select') {
      return { relationIds: [], names: this.sortAndDedupe(this.getMultiSelectFromProperty(property)) };
    }
    return { relationIds: [], names: [] };
  }
}

/**
 * Maps Notion pages to Equipment entities
 */
class EquipmentMapper extends NotionDataMapper {
  mapPage(page, language) {
    const properties = page.properties || {};
    const nameProperty = this.findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre']) || 
                         this.findFirstPropertyByType(properties, 'title');
    const typeProperty = this.findPropertyByAliases(properties, ['type', 'type de machine']);
    const placeProperty = this.findPropertyByAliases(properties, ['place', 'lieu']);
    const categoriesProperty = this.findPropertyByAliases(properties, ['Categories', 'Catégories', 'catégories', 'categories']);
    const tutorialsProperty = this.findPropertyByAliases(properties, ['Tutoriels', 'tutoriels', 'Tutorials', 'tutorials']);
    const userManualProperty = this.findPropertyByAliases(properties, ['manuel utilisateur', 'user manual']);
    const statusProperty = this.findPropertyByAliases(properties, ['status', 'statut']);

    const name = this.getPlainTextFromProperty(nameProperty);
    if (!name) {
      this.addWarning(`Skipped equipment ${page.id}: missing name.`);
      return null;
    }

    if (!page.public_url) {
      this.addWarning(`Skipped equipment ${page.id}: missing Notion page url.`);
      return null;
    }

    return {
      id: page.id,
      name,
      type: this.getPlainTextFromProperty(typeProperty),
      placeNames: this.sortAndDedupe(this.getMultiSelectFromProperty(placeProperty)),
      notionUrl: page.public_url,
      published: this.isPublishedStatus(this.getPlainTextFromProperty(statusProperty)),
      categoryIds: this.sortAndDedupe(this.getRelationIdsFromProperty(categoriesProperty)),
      tutorialIds: this.sortAndDedupe(this.getRelationIdsFromProperty(tutorialsProperty)),
      userManualUrl: this.getImageUrlFromProperty(userManualProperty),
      iconUrl: this.getPageIconUrl(page.icon)
    };
  }
}

/**
 * Maps Notion pages to Category entities
 */
class CategoryMapper extends NotionDataMapper {
  mapPage(page, language) {
    const properties = page.properties || {};
    const nameProperty = this.findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre']) || 
                         this.findFirstPropertyByType(properties, 'title');
    const slugProperty = this.findPropertyByAliases(properties, ['slug']);
    const colorProperty = this.findPropertyByAliases(properties, ['color', 'colour']);
    const tutorialsProperty = this.findPropertyByAliases(properties, ['tutoriels', 'tutorials', '🔌 tutoriels']);
    const equipmentProperty = this.findPropertyByAliases(properties, ['equipements', 'equipment', '⚙️ machines', '⚙️ equipements']);
    const languageProperty = this.findPropertyByAliases(properties, ['language', 'lang', 'langue']);

    const name = this.getPlainTextFromProperty(nameProperty);
    if (!name) {
      this.addWarning(`Skipped category ${page.id}: missing name.`);
      return null;
    }

    return {
      id: page.id,
      slug: this.normalizeSlug(this.getPlainTextFromProperty(slugProperty)),
      name,
      color: this.normalizeHexColor(this.getPlainTextFromProperty(colorProperty)),
      language: this.normalizeLanguageValue(this.getPlainTextFromProperty(languageProperty), language),
      tutorialIds: this.sortAndDedupe(this.getRelationIdsFromProperty(tutorialsProperty)),
      equipmentIds: this.sortAndDedupe(this.getRelationIdsFromProperty(equipmentProperty))
    };
  }
}

/**
 * Maps Notion pages to Software entities
 */
class SoftwareMapper extends NotionDataMapper {
  mapPage(page, language) {
    const properties = page.properties || {};
    const nameProperty = this.findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre']) || 
                         this.findFirstPropertyByType(properties, 'title');
    const slugProperty = this.findPropertyByAliases(properties, ['slug']);
    const tutorialsProperty = this.findPropertyByAliases(properties, ['tutorials', 'tutoriels']);
    const languageProperty = this.findPropertyByAliases(properties, ['language', 'lang', 'langue']);

    const name = this.getPlainTextFromProperty(nameProperty);
    if (!name) {
      this.addWarning(`Skipped software ${page.id}: missing name.`);
      return null;
    }

    return {
      id: page.id,
      slug: this.normalizeSlug(this.getPlainTextFromProperty(slugProperty)),
      name,
      language: this.normalizeLanguageValue(this.getPlainTextFromProperty(languageProperty), language),
      tutorialIds: this.sortAndDedupe(this.getRelationIdsFromProperty(tutorialsProperty))
    };
  }
}

/**
 * Maps Notion pages to Course entities (with full course details)
 */
class CourseMapper extends NotionDataMapper {
  mapPage(page, language) {
    const properties = page.properties || {};
    const nameProperty = this.findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre', 'name en', 'name fr']) ||
                         this.findFirstPropertyByType(properties, 'title');
    const descriptionProperty = this.findPropertyByAliases(properties, ['description', 'content', 'summary']) ||
                                this.findFirstPropertyByType(properties, 'rich_text');
    const programsProperty = this.findPropertyByAliases(properties, ['programs', 'program', 'tracks']);
    const colorProperty = this.findPropertyByAliases(properties, ['color', 'colour']);
    const slugProperty = this.findPropertyByAliases(properties, ['slug']);
    const languageProperty = this.findPropertyByAliases(properties, ['language', 'lang', 'langue']);
    const tutorialsProperty = this.findPropertyByAliases(properties, ['tutorials', 'tutoriels']);

    const name = this.getPlainTextFromProperty(nameProperty);
    if (!name) {
      this.addWarning(`Skipped course ${page.id}: missing name.`);
      return null;
    }

    if (!page.public_url) {
      this.addWarning(`Skipped course ${page.id}: missing Notion page url.`);
      return null;
    }

    const langValue = this.normalizeLanguageValue(this.getPlainTextFromProperty(languageProperty), language);
    if (!langValue) {
      this.addWarning(`Skipped course ${page.id}: invalid language value.`);
      return null;
    }

    return {
      id: page.id,
      slug: this.normalizeSlug(this.getPlainTextFromProperty(slugProperty)),
      name,
      programs: this.getMultiSelectFromProperty(programsProperty),
      description: this._getRichTextAsHtml(descriptionProperty?.rich_text || []),
      color: this.normalizeHexColor(this.getPlainTextFromProperty(colorProperty)),
      language: langValue,
      notionUrl: page.public_url,
      tutorialIds: this.sortAndDedupe(this.getRelationIdsFromProperty(tutorialsProperty))
    };
  }

  _getRichTextAsHtml(richTextArray) {
    if (!Array.isArray(richTextArray) || richTextArray.length === 0) {
      return '';
    }
    return richTextArray.map((chunk) => {
      let html = this._escapeHtml(chunk.plain_text || '');
      const annotations = chunk.annotations || {};
      if (annotations.code) html = `<code>${html}</code>`;
      if (annotations.bold) html = `<strong>${html}</strong>`;
      if (annotations.italic) html = `<em>${html}</em>`;
      if (annotations.strikethrough) html = `<s>${html}</s>`;
      if (annotations.underline) html = `<u>${html}</u>`;
      if (chunk.href) html = `<a href="${this._escapeHtml(chunk.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      return html;
    }).join('');
  }

  _escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

/**
 * Maps Notion pages to Popup entities
 */
class PopupMapper extends NotionDataMapper {
  mapPage(page) {
    const properties = page.properties || {};
    const startsOnDate = this._getDateFromProperty(properties['starts-on'], 'start');
    const endsOnDate = this._getDateFromProperty(properties['ends-on'], 'start') || startsOnDate;

    return {
      id: page.id,
      titleFr: this.getPlainTextFromProperty(properties['title fr']),
      contentFr: this._getRichTextAsHtml(properties['content fr']?.rich_text),
      titleEn: this.getPlainTextFromProperty(properties['title en']),
      contentEn: this._getRichTextAsHtml(properties['content en']?.rich_text),
      startsOn: startsOnDate ? this._toIsoDate(startsOnDate) : null,
      endsOn: endsOnDate ? this._toIsoDate(endsOnDate) : null,
      startsOnEpoch: startsOnDate ? this._normalizeToUtcDayStart(startsOnDate).getTime() : Number.POSITIVE_INFINITY,
      endsOnEpoch: endsOnDate ? this._normalizeToUtcDayStart(endsOnDate).getTime() : Number.NEGATIVE_INFINITY
    };
  }

  _getDateFromProperty(property, key) {
    if (!property || property.type !== 'date' || !property.date || !property.date[key]) {
      return null;
    }
    const date = new Date(property.date[key]);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  _normalizeToUtcDayStart(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  _toIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  _getRichTextAsHtml(richTextArray) {
    if (!Array.isArray(richTextArray) || richTextArray.length === 0) {
      return '';
    }
    return richTextArray.map((chunk) => {
      let html = this._escapeHtml(chunk.plain_text || '');
      const annotations = chunk.annotations || {};
      if (annotations.code) html = `<code>${html}</code>`;
      if (annotations.bold) html = `<strong>${html}</strong>`;
      if (annotations.italic) html = `<em>${html}</em>`;
      if (annotations.strikethrough) html = `<s>${html}</s>`;
      if (annotations.underline) html = `<u>${html}</u>`;
      if (chunk.href) html = `<a href="${this._escapeHtml(chunk.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      return html;
    }).join('');
  }

  _escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }
}

module.exports = {
  TutorialMapper,
  EquipmentMapper,
  CategoryMapper,
  SoftwareMapper,
  CourseMapper,
  PopupMapper
};
