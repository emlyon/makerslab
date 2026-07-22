const fs = require('fs');
const path = require('path');

function loadDotEnvIfPresent(repoRoot) {
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    require('dotenv').config({ path: envPath });
  } catch (_error) {
    // Do nothing when dotenv is unavailable in CI.
  }
}

function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

function getPlainTextFromProperty(property) {
  if (!property) {
    return '';
  }

  if (property.type === 'title') {
    return property.title.map((chunk) => chunk.plain_text).join('').trim();
  }

  if (property.type === 'rich_text') {
    return property.rich_text.map((chunk) => chunk.plain_text).join('').trim();
  }

  if (property.type === 'select') {
    return property.select?.name?.trim() || '';
  }

  if (property.type === 'status') {
    return property.status?.name?.trim() || '';
  }

  if (property.type === 'url') {
    return String(property.url || '').trim();
  }

  return '';
}

function getRichTextAsHtml(richTextArray) {
  if (!Array.isArray(richTextArray) || richTextArray.length === 0) {
    return '';
  }

  return richTextArray
    .map((chunk) => {
      let html = escapeHtml(chunk.plain_text || '');
      const annotations = chunk.annotations || {};

      if (annotations.code) {
        html = `<code>${html}</code>`;
      }
      if (annotations.bold) {
        html = `<strong>${html}</strong>`;
      }
      if (annotations.italic) {
        html = `<em>${html}</em>`;
      }
      if (annotations.strikethrough) {
        html = `<s>${html}</s>`;
      }
      if (annotations.underline) {
        html = `<u>${html}</u>`;
      }

      if (chunk.href) {
        html = `<a href="${escapeHtml(chunk.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      }

      return html;
    })
    .join('');
}

function getMultiSelectFromProperty(property) {
  if (!property || property.type !== 'multi_select' || !Array.isArray(property.multi_select)) {
    return [];
  }

  return property.multi_select.map((item) => item.name).filter(Boolean);
}

function normalizeHexColor(value, fallback = '#e2001a') {
  const raw = String(value || '').trim();
  if (!raw) {
    return fallback;
  }

  const candidate = raw.startsWith('#') ? raw : `#${raw}`;
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(candidate);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return candidate.toLowerCase();
  }

  return fallback;
}

async function fetchAllPages(notionClient, dataSourceId) {
  const pages = [];
  let hasMore = true;
  let startCursor;

  while (hasMore) {
    const response = await notionClient.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: startCursor,
      page_size: 100
    });

    pages.push(...response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return pages;
}

module.exports = {
  escapeHtml,
  fetchAllPages,
  getMultiSelectFromProperty,
  getPlainTextFromProperty,
  getRichTextAsHtml,
  loadDotEnvIfPresent,
  normalizeHexColor
};
