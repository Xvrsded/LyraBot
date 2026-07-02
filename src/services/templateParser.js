class TemplateParser {
    /**
     * Parses a raw template JSON by recursively resolving inheritance and deep merging fields.
     * @param {object} template The raw template JSON object to parse
     * @param {Map<string, object>} registry Map containing all raw templates registered
     * @returns {object} The resolved, merged, final template object
     * @throws {Error} If parent template is missing or inheritance loop occurs
     */
    parse(template, registry) {
        if (!template.extends) {
            return JSON.parse(JSON.stringify(template)); // Deep clone
        }

        const parentName = template.extends;
        const parentRaw = registry.get(parentName);
        if (!parentRaw) {
            throw new Error(`Parent template "${parentName}" tidak ditemukan di registri.`);
        }

        // Recursively parse parent first to support chain inheritance
        const parentParsed = this.parse(parentRaw, registry);

        // Deep clone parsed parent to serve as base merge target
        const merged = JSON.parse(JSON.stringify(parentParsed));

        // 1. Merge core descriptions
        merged.name = template.name || merged.name;
        merged.description = template.description || merged.description;
        merged.author = template.author || merged.author;
        merged.version = template.version || merged.version;
        
        // Track inheritance chain for diagnostics
        merged.extendedFrom = merged.extendedFrom || [];
        merged.extendedFrom.push(parentName);

        // 2. Merge Settings
        if (template.settings) {
            merged.settings = { ...merged.settings, ...template.settings };
        }

        // 3. Merge Roles by role name
        if (template.roles) {
            template.roles.forEach(childRole => {
                const parentRoleIdx = merged.roles.findIndex(r => r.name === childRole.name);
                if (parentRoleIdx !== -1) {
                    merged.roles[parentRoleIdx] = { ...merged.roles[parentRoleIdx], ...childRole };
                } else {
                    merged.roles.push(childRole);
                }
            });
        }

        // 4. Merge Categories by category name
        if (template.categories) {
            template.categories.forEach(childCat => {
                const parentCatIdx = merged.categories.findIndex(c => c.name === childCat.name);
                if (parentCatIdx !== -1) {
                    merged.categories[parentCatIdx] = { ...merged.categories[parentCatIdx], ...childCat };
                } else {
                    merged.categories.push(childCat);
                }
            });
        }

        // 5. Merge Channels by combination of "parent:name"
        if (template.channels) {
            template.channels.forEach(childChan => {
                const parentChanIdx = merged.channels.findIndex(c => c.name === childChan.name && c.parent === childChan.parent);
                if (parentChanIdx !== -1) {
                    merged.channels[parentChanIdx] = { ...merged.channels[parentChanIdx], ...childChan };
                } else {
                    merged.channels.push(childChan);
                }
            });
        }

        // 6. Merge Welcome Config
        if (template.welcome) {
            merged.welcome = { ...merged.welcome, ...template.welcome };
        }

        // 7. Merge Logs Config
        if (template.logs) {
            merged.logs = { ...merged.logs, ...template.logs };
        }

        // Remove the "extends" property to mark it resolved
        delete merged.extends;

        return merged;
    }
}

module.exports = new TemplateParser();
