#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

/**
 * Slugify a string for use in filenames
 * @param {string} value - The value to slugify
 * @returns {string} - Slugified value
 */
function slugify(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extracts file extension from URL or returns default
 * @param {string} url - The URL to extract extension from
 * @param {string} defaultExt - Default extension if not found
 * @returns {string} - File extension without the dot
 */
function getFileExtension(url, defaultExt = 'png') {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  } catch (_error) {
    // Invalid URL, use default
  }
  return defaultExt;
}

/**
 * Downloads a file from URL and returns its content as Buffer
 * @param {string} url - The URL to download from
 * @returns {Promise<Buffer>} - The downloaded content
 * @throws {Error} - If download fails
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = 30000; // 30 seconds

    const req = protocol.get(url, { timeout }, (response) => {
      // Handle redirects (3xx)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.abort();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Calculates SHA256 hash of a buffer
 * @param {Buffer} buffer - The buffer to hash
 * @returns {string} - Hex-encoded hash (first 12 characters for brevity)
 */
function calculateHash(buffer) {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return hash.substring(0, 12);
}

/**
 * Downloads a single image from URL and caches it locally
 * Returns null if URL is empty or if download fails
 * Returns local path like "/media/equipment/{hash}-equipment-{slug}.png" on success
 * 
 * @param {string} url - The URL to download
 * @param {string} outputDir - Output directory (e.g., "build/media/equipment")
 * @param {string} resourceName - Resource name for filename (e.g., "equipment")
 * @param {object} record - Record object with id/name for slug generation
 * @returns {Promise<string|null>} - Local path or null
 */
async function downloadImage(url, outputDir, resourceName, record) {
  // Validate inputs
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  try {
    // Download file
    const fileBuffer = await downloadFile(trimmedUrl);

    // Calculate hash
    const hash = calculateHash(fileBuffer);
    const extension = getFileExtension(trimmedUrl, 'png');
    
    // Generate slug from record name or id
    const slug = record && record.name ? slugify(record.name) : (record?.id || '');
    const filename = slug 
      ? `${hash}-${resourceName}-${slug}.${extension}`
      : `${hash}-${resourceName}.${extension}`;
    
    const filePath = path.join(outputDir, filename);

    // Check if file already exists (deduplication)
    if (fs.existsSync(filePath)) {
      return `/media/${resourceName}/${filename}`;
    }

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Write file to disk
    fs.writeFileSync(filePath, fileBuffer);

    return `/media/${resourceName}/${filename}`;
  } catch (error) {
    return null;
  }
}

/**
 * Batch processes records and downloads images for specified fields
 * Skips null/empty URLs (emojis and non-downloadable icons already filtered by mapper)
 * Returns modified records with local image paths
 * 
 * @param {Array} records - Array of records to process
 * @param {Array<string>} imageFieldNames - Fields to process (e.g., ["iconUrl", "userManualUrl"])
 * @param {string} resourceName - Resource name for filenames (e.g., "equipment")
 * @param {string} outputRoot - Root output directory (e.g., "build")
 * @returns {Promise<{records: Array, warnings: Array}>} - Modified records and warnings
 */
async function downloadAndCacheImages(records, imageFieldNames, resourceName, outputRoot) {
  const warnings = [];
  const outputDir = path.join(outputRoot, 'build', 'media', resourceName);

  if (!Array.isArray(records)) {
    return { records, warnings };
  }

  if (!Array.isArray(imageFieldNames) || imageFieldNames.length === 0) {
    return { records, warnings };
  }

  // Process each record
  const processedRecords = [];
  for (const record of records) {
    const processedRecord = { ...record };

    for (const fieldName of imageFieldNames) {
      const originalUrl = processedRecord[fieldName];

      // Skip null/empty/non-string values
      if (!originalUrl || typeof originalUrl !== 'string') {
        processedRecord[fieldName] = null;
        continue;
      }

      const trimmedUrl = originalUrl.trim();

      // Skip if empty after trimming
      if (!trimmedUrl) {
        processedRecord[fieldName] = null;
        continue;
      }

      try {
        const localPath = await downloadImage(trimmedUrl, outputDir, resourceName, record);
        if (localPath) {
          processedRecord[fieldName] = localPath;
        } else {
          // Download failed
          warnings.push(`[image-downloader][${resourceName}] Failed to download ${fieldName} for record ${record.id}: ${trimmedUrl}`);
          processedRecord[fieldName] = null;
        }
      } catch (error) {
        warnings.push(`[image-downloader][${resourceName}] Error processing ${fieldName} for record ${record.id}: ${error.message}`);
        processedRecord[fieldName] = null;
      }
    }

    processedRecords.push(processedRecord);
  }

  return { records: processedRecords, warnings };
}

module.exports = {
  slugify,
  getFileExtension,
  downloadFile,
  calculateHash,
  downloadImage,
  downloadAndCacheImages
};
