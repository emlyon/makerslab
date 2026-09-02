#!/usr/bin/env node

/**
 * Reconciles bidirectional relationships between entities
 */
class RelationshipReconciler {
  constructor() {
    this.warnings = [];
  }

  /**
   * Reconcile relationships for tutorials dataset
   */
  reconcileTutorialRelationships(languageData, language) {
    const tutorialsById = this._mapById(languageData.tutorials);
    const equipmentsById = this._mapById(languageData.equipments);
    const categoriesById = this._mapById(languageData.categories);
    const softwareById = this._mapById(languageData.software);
    const coursesById = this._mapById(languageData.courses);

    const tutorialEquipmentLinks = new Map();
    const tutorialCategoryLinks = new Map();
    const tutorialSoftwareLinks = new Map();
    const tutorialCourseLinks = new Map();
    const equipmentCategoryLinks = new Map();

    // Forward pass: tutorials -> equipment/category/software/course
    for (const tutorial of languageData.tutorials) {
      for (const equipmentId of tutorial.equipmentIds) {
        if (!equipmentsById.has(equipmentId)) {
          this._addWarning(`[${language}] Tutorial ${tutorial.id} references missing equipment ${equipmentId}.`);
          continue;
        }
        this._pushLink(tutorialEquipmentLinks, tutorial.id, equipmentId);
      }

      for (const categoryId of tutorial.categoryIds) {
        if (!categoriesById.has(categoryId)) {
          this._addWarning(`[${language}] Tutorial ${tutorial.id} references missing category ${categoryId}.`);
          continue;
        }
        this._pushLink(tutorialCategoryLinks, tutorial.id, categoryId);
      }

      for (const softwareId of tutorial.softwareIds) {
        if (!softwareById.has(softwareId)) {
          this._addWarning(`[${language}] Tutorial ${tutorial.id} references missing software ${softwareId}.`);
          continue;
        }
        this._pushLink(tutorialSoftwareLinks, tutorial.id, softwareId);
      }

      for (const courseId of tutorial.courseIds) {
        if (!coursesById.has(courseId)) {
          this._addWarning(`[${language}] Tutorial ${tutorial.id} references missing course ${courseId}.`);
          continue;
        }
        this._pushLink(tutorialCourseLinks, tutorial.id, courseId);
      }
    }

    // Auto-detect software links based on software names in tutorial titles
    for (const tutorial of languageData.tutorials) {
      for (const software of languageData.software) {
        // Skip if link already exists
        if (tutorial.softwareIds.includes(software.id)) {
          continue;
        }
        
        // Check if software name appears in tutorial name (case-insensitive)
        const tutorialNameLower = tutorial.name.toLowerCase();
        const softwareNameLower = software.name.toLowerCase();
        
        if (tutorialNameLower.includes(softwareNameLower)) {
          this._pushLink(tutorialSoftwareLinks, tutorial.id, software.id);
          this._addWarning(`[${language}] Auto-detected software "${software.name}" in tutorial "${tutorial.name}" (no explicit link in Notion).`);
        }
      }
    }

    // Forward pass: equipment -> tutorial/category
    for (const equipment of languageData.equipments) {
      for (const tutorialId of equipment.tutorialIds) {
        if (!tutorialsById.has(tutorialId)) {
          this._addWarning(`[${language}] Equipment ${equipment.id} references missing tutorial ${tutorialId}.`);
          continue;
        }
        this._pushLink(tutorialEquipmentLinks, tutorialId, equipment.id);
      }

      for (const categoryId of equipment.categoryIds) {
        if (!categoriesById.has(categoryId)) {
          this._addWarning(`[${language}] Equipment ${equipment.id} references missing category ${categoryId}.`);
          continue;
        }
        this._pushLink(equipmentCategoryLinks, equipment.id, categoryId);
      }
    }

    // Reverse pass: categories -> tutorials/equipment
    for (const category of languageData.categories) {
      for (const tutorialId of category.tutorialIds) {
        if (!tutorialsById.has(tutorialId)) {
          this._addWarning(`[${language}] Category ${category.id} references missing tutorial ${tutorialId}.`);
          continue;
        }
        this._pushLink(tutorialCategoryLinks, tutorialId, category.id);
      }

      for (const equipmentId of category.equipmentIds) {
        if (!equipmentsById.has(equipmentId)) {
          this._addWarning(`[${language}] Category ${category.id} references missing equipment ${equipmentId}.`);
          continue;
        }
        this._pushLink(equipmentCategoryLinks, equipmentId, category.id);
      }
    }

    // Reverse pass: software -> tutorials
    for (const software of languageData.software) {
      for (const tutorialId of software.tutorialIds) {
        if (!tutorialsById.has(tutorialId)) {
          this._addWarning(`[${language}] Software ${software.id} references missing tutorial ${tutorialId}.`);
          continue;
        }
        this._pushLink(tutorialSoftwareLinks, tutorialId, software.id);
      }
    }

    // Reverse pass: courses -> tutorials
    for (const course of languageData.courses) {
      for (const tutorialId of course.tutorialIds) {
        if (!tutorialsById.has(tutorialId)) {
          this._addWarning(`[${language}] Course ${course.id} references missing tutorial ${tutorialId}.`);
          continue;
        }
        this._pushLink(tutorialCourseLinks, tutorialId, course.id);
      }
    }

    // Finalize tutorials
    for (const tutorial of languageData.tutorials) {
      tutorial.equipmentIds = this._sortAndDedupe([...(tutorialEquipmentLinks.get(tutorial.id) || [])]);
      tutorial.categoryIds = this._sortAndDedupe([...(tutorialCategoryLinks.get(tutorial.id) || [])]);
      tutorial.softwareIds = this._sortAndDedupe([...(tutorialSoftwareLinks.get(tutorial.id) || [])]);
      tutorial.courseIds = this._sortAndDedupe([...(tutorialCourseLinks.get(tutorial.id) || [])]);
      tutorial.courseNames = this._sortAndDedupe([
        ...(Array.isArray(tutorial.courseNames) ? tutorial.courseNames : []),
        ...tutorial.courseIds.map((courseId) => coursesById.get(courseId)?.name).filter(Boolean)
      ]);
    }

    // Finalize equipment
    for (const equipment of languageData.equipments) {
      const tutorialIds = [];
      for (const tutorial of languageData.tutorials) {
        if (tutorial.equipmentIds.includes(equipment.id)) {
          tutorialIds.push(tutorial.id);
        }
      }
      equipment.tutorialIds = this._sortAndDedupe(tutorialIds);
      equipment.categoryIds = this._sortAndDedupe([...(equipmentCategoryLinks.get(equipment.id) || [])]);
    }

    // Finalize categories
    for (const category of languageData.categories) {
      const tutorialIds = [];
      const equipmentIds = [];
      for (const tutorial of languageData.tutorials) {
        if (tutorial.categoryIds.includes(category.id)) {
          tutorialIds.push(tutorial.id);
        }
      }
      for (const equipment of languageData.equipments) {
        if (equipment.categoryIds.includes(category.id)) {
          equipmentIds.push(equipment.id);
        }
      }
      category.tutorialIds = this._sortAndDedupe(tutorialIds);
      category.equipmentIds = this._sortAndDedupe(equipmentIds);
    }

    // Finalize software
    for (const software of languageData.software) {
      const tutorialIds = [];
      for (const tutorial of languageData.tutorials) {
        if (tutorial.softwareIds.includes(software.id)) {
          tutorialIds.push(tutorial.id);
        }
      }
      software.tutorialIds = this._sortAndDedupe(tutorialIds);
    }

    // Finalize courses
    for (const course of languageData.courses) {
      const tutorialIds = [];
      for (const tutorial of languageData.tutorials) {
        if (tutorial.courseIds.includes(course.id)) {
          tutorialIds.push(tutorial.id);
        }
      }
      course.tutorialIds = this._sortAndDedupe(tutorialIds);
    }
  }

  /**
   * Reconcile relationships for equipments dataset
   */
  reconcileEquipmentRelationships(languageData, language) {
    const equipmentsById = this._mapById(languageData.equipments);
    const categoriesById = this._mapById(languageData.categories);

    const equipmentCategoryLinks = new Map();

    // Forward pass: equipment -> categories
    for (const equipment of languageData.equipments) {
      for (const categoryId of equipment.categoryIds) {
        if (!categoriesById.has(categoryId)) {
          this._addWarning(`[${language}] Equipment ${equipment.id} references missing category ${categoryId}.`);
          continue;
        }
        this._pushLink(equipmentCategoryLinks, equipment.id, categoryId);
      }
    }

    // Reverse pass: categories -> equipment
    for (const category of languageData.categories) {
      for (const equipmentId of category.equipmentIds) {
        if (!equipmentsById.has(equipmentId)) {
          this._addWarning(`[${language}] Category ${category.id} references missing equipment ${equipmentId}.`);
          continue;
        }
        this._pushLink(equipmentCategoryLinks, equipmentId, category.id);
      }
    }

    // Finalize equipment
    for (const equipment of languageData.equipments) {
      equipment.categoryIds = this._sortAndDedupe([...(equipmentCategoryLinks.get(equipment.id) || [])]);
    }

    // Finalize categories
    for (const category of languageData.categories) {
      const equipmentIds = [];
      for (const equipment of languageData.equipments) {
        if (equipment.categoryIds.includes(category.id)) {
          equipmentIds.push(equipment.id);
        }
      }
      category.equipmentIds = this._sortAndDedupe(equipmentIds);
    }
  }

  _mapById(records) {
    return new Map(records.map((record) => [record.id, record]));
  }

  _pushLink(linksMap, sourceId, targetId) {
    if (!linksMap.has(sourceId)) {
      linksMap.set(sourceId, new Set());
    }
    linksMap.get(sourceId).add(targetId);
  }

  _sortAndDedupe(values) {
    return [...new Set(values.filter(Boolean))].sort((left, right) => 
      String(left).localeCompare(String(right))
    );
  }

  _addWarning(message) {
    this.warnings.push(message);
  }

  getWarnings() {
    return [...this.warnings];
  }
}

module.exports = RelationshipReconciler;
