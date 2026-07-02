const fs = require('fs');
const path = require('path');
const templateValidator = require('./templateValidator');
const templateParser = require('./templateParser');
const logger = require('../utils/logger');

class TemplateLoader {
    constructor() {
        this.templatesPath = path.join(__dirname, '../templates');
        this.rawRegistry = new Map();   // name -> raw JSON
        this.parsedRegistry = new Map(); // name -> parsed JSON
        
        // Auto-initialize loading
        this.reload();
    }

    /**
     * Re-scans the templates folder, reloads all files, and compiles registry in memory.
     * @returns {void}
     */
    reload() {
        logger.info('[TemplateLoader] Scanning templates folder...');
        this.rawRegistry.clear();
        this.parsedRegistry.clear();

        if (!fs.existsSync(this.templatesPath)) {
            logger.warn(`[TemplateLoader] Folder templates tidak ditemukan di path: ${this.templatesPath}. Membuat folder...`);
            fs.mkdirSync(this.templatesPath, { recursive: true });
            return;
        }

        // 1. Read and load all raw JSON files
        const files = fs.readdirSync(this.templatesPath).filter(f => f.endsWith('.json'));
        for (const file of files) {
            try {
                const filePath = path.join(this.templatesPath, file);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const rawTemplate = JSON.parse(fileContent);

                const templateName = rawTemplate.name || path.basename(file, '.json');
                this.rawRegistry.set(templateName, rawTemplate);
                logger.debug(`[TemplateLoader] Loaded raw template: "${templateName}" from file "${file}"`);
            } catch (err) {
                logger.error(`[TemplateLoader] Gagal membaca file template "${file}":`, err.message);
            }
        }

        // 2. Parse and merge inheritance for all loaded templates
        for (const [name, raw] of this.rawRegistry.entries()) {
            try {
                const parsed = templateParser.parse(raw, this.rawRegistry);
                
                // Validate parsed result
                const validation = templateValidator.validate(parsed);
                if (!validation.valid) {
                    logger.warn(`[TemplateLoader] Template "${name}" gagal validasi:\n- ${validation.errors.join('\n- ')}`);
                } else {
                    this.parsedRegistry.set(name, parsed);
                    logger.info(`[TemplateLoader] Compiled & validated template: "${name}"`);
                }
            } catch (err) {
                logger.error(`[TemplateLoader] Gagal mengompilasi template "${name}":`, err.message);
            }
        }
        logger.info(`[TemplateLoader] Scan complete. ${this.parsedRegistry.size} templates compiled successfully.`);
    }

    /**
     * Loads a single compiled template.
     * @param {string} name Template name
     * @returns {object|null} Parsed template, or null if it doesn't exist
     */
    load(name) {
        return this.parsedRegistry.get(name) || null;
    }

    /**
     * Gets all loaded and compiled templates.
     * @returns {Map<string, object>} Map of parsed templates
     */
    loadAll() {
        return this.parsedRegistry;
    }

    /**
     * Checks if a template is registered.
     * @param {string} name Template name
     * @returns {boolean}
     */
    exists(name) {
        return this.parsedRegistry.has(name);
    }

    /**
     * Exposes validation method helper.
     * @param {object} template Template object to validate
     * @returns {{ valid: boolean, errors: string[] }} Validation result
     */
    validate(template) {
        return templateValidator.validate(template);
    }
}

module.exports = new TemplateLoader();
