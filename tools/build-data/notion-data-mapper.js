/**
 * Base class providing Notion API and property extraction utilities
 */
class NotionDataMapper {
  constructor(notion) {
    this.notion = notion;
    this.warnings = [];
  }

  /**
   * Fetch all pages from a Notion database with pagination
   */
  async fetchAllPages(databaseId) {
    const pages = [];
    let cursor = undefined;
    
    while (true) {
      const response = await this.notion.dataSources.query({
        data_source_id: databaseId,
        start_cursor: cursor,
        page_size: 100
      });
      
      pages.push(...response.results);
      
      if (!response.has_more) break;
      cursor = response.next_cursor;
    }
    
    return pages;
  }

  /**
   * Find a property by checking multiple alias names
   */
  findPropertyByAliases(properties, aliases) {
    if (!properties || !Array.isArray(aliases)) return null;
    
    for (const alias of aliases) {
      if (properties[alias]) {
        return properties[alias];
      }
    }
    
    return null;
  }

  /**
   * Find first property by type
   */
  findFirstPropertyByType(properties, type) {
    if (!properties) return null;
    
    for (const [_key, property] of Object.entries(properties)) {
      if (property && property.type === type) {
        return property;
      }
    }
    
    return null;
  }

  /**
   * Extract plain text from various property types
   */
  getPlainTextFromProperty(property) {
    if (!property) return '';
    
    switch (property.type) {
      case 'title':
        return property.title?.[0]?.plain_text || '';
      case 'rich_text':
        return property.rich_text?.map((block) => block.plain_text).join('') || '';
      case 'select':
        return property.select?.name || '';
      case 'status':
        return property.status?.name || '';
      case 'url':
        return property.url || '';
      default:
        return '';
    }
  }

  /**
   * Extract array of multi-select option names
   */
  getMultiSelectFromProperty(property) {
    if (!property || property.type !== 'multi_select' || !Array.isArray(property.multi_select)) {
      return [];
    }
    
    return property.multi_select.map((option) => option.name);
  }

  /**
   * Extract relation IDs from a relation property
   */
  getRelationIdsFromProperty(property) {
    if (!property || property.type !== 'relation' || !Array.isArray(property.relation)) {
      return [];
    }
    
    return property.relation.map((rel) => rel.id);
  }

  /**
   * Extract image URL from file property
   */
  getImageUrlFromProperty(property) {
    if (!property || property.type !== 'files' || !Array.isArray(property.files) || property.files.length === 0) {
      return '';
    }
    
    const file = property.files[0];
    if (file.type === 'file') {
      return file.file?.url || '';
    } else if (file.type === 'external') {
      return file.external?.url || '';
    }
    
    return '';
  }

  /**
   * Extract icon URL from page.icon (Notion page icon, not a property)
   * Returns URL only for downloadable types (external/file), null for emojis/icons
   * 
   * Type reference:
   * - "emoji": standard emoji (skip - not downloadable)
   * - "custom_emoji": workspace emoji (skip - not downloadable)
   * - "icon": native Notion icon (skip - not downloadable)
   * - "external": externally hosted image URL (download)
   * - "file": Notion-hosted file (download)
   */
  getPageIconUrl(pageIcon) {
    if (!pageIcon || !pageIcon.type) return null;
    
    switch (pageIcon.type) {
      case 'external':
        return pageIcon.external?.url || null;
      case 'file':
        return pageIcon.file?.url || null;
      // Emoji types and native icons are not downloadable
      case 'emoji':
      case 'custom_emoji':
      case 'icon':
        return null;
      default:
        return null;
    }
  }

  /**
   * Sort and deduplicate array values
   */
  sortAndDedupe(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values)].sort();
  }

  /**
   * Sort records by name property
   */
  sortRecords(records) {
    if (!Array.isArray(records)) return [];
    return [...records].sort((a, b) => {
      const aName = String(a.name || '').toLowerCase();
      const bName = String(b.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  }

  /**
   * Normalize slug by removing special characters
   */
  normalizeSlug(slug) {
    if (!slug) return '';
    return String(slug).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /**
   * Normalize language value
   */
  normalizeLanguageValue(value, defaultLanguage) {
    if (!value) return defaultLanguage;
    const normalized = String(value).toLowerCase().trim();
    if (normalized === 'en' || normalized === 'english') return 'en';
    if (normalized === 'fr' || normalized === 'french' || normalized === 'français') return 'fr';
    return defaultLanguage;
  }

  /**
   * Check if status indicates published
   */
  isPublishedStatus(status) {
    if (!status) return false;
    const normalized = String(status).toLowerCase().trim();
    return normalized === 'published' || normalized === 'publie' || normalized === 'publié';
  }

  /**
   * Normalize hex color
   */
  normalizeHexColor(color) {
    if (!color) return '#d32f2f';
    const hex = String(color).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
    return '#d32f2f';
  }

  /**
   * Add a warning message
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Get all warnings
   */
  getWarnings() {
    return this.warnings;
  }

  /**
   * Clear warnings
   */
  clearWarnings() {
    this.warnings = [];
  }
}

module.exports = NotionDataMapper;
