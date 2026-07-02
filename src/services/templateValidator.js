const { PermissionFlagsBits } = require('discord.js');

class TemplateValidator {
    constructor() {
        this.validPermissions = Object.keys(PermissionFlagsBits);
        this.supportedVersions = ['v1'];
    }

    /**
     * Validates a template structure and values.
     * @param {object} template The raw template JSON object
     * @returns {{ valid: boolean, errors: string[] }} Validation result
     */
    validate(template) {
        const errors = [];

        if (!template || typeof template !== 'object') {
            return { valid: false, errors: ['Template tidak boleh kosong dan harus bertipe Object.'] };
        }

        // 1. Mandatory base structural fields
        const requiredFields = ['version', 'name', 'description', 'author'];
        for (const field of requiredFields) {
            if (!template[field]) {
                errors.push(`Missing field: Template harus memiliki field "${field}".`);
            }
        }

        // 2. Supported version
        if (template.version && !this.supportedVersions.includes(template.version)) {
            errors.push(`Unsupported version: Versi template "${template.version}" tidak didukung. Versi yang didukung: ${this.supportedVersions.join(', ')}.`);
        }

        // 3. Validate Roles
        if (template.roles) {
            if (!Array.isArray(template.roles)) {
                errors.push('Invalid roles: Field "roles" harus berupa Array.');
            } else {
                const seenRoleNames = new Set();
                template.roles.forEach((role, idx) => {
                    if (!role.name) {
                        errors.push(`Missing role name: Role pada indeks ke-${idx} tidak memiliki field "name".`);
                    } else {
                        if (seenRoleNames.has(role.name)) {
                            errors.push(`Duplicate role name: Nama role "${role.name}" didefinisikan lebih dari satu kali.`);
                        }
                        seenRoleNames.add(role.name);
                    }

                    if (role.permissions) {
                        if (!Array.isArray(role.permissions)) {
                            errors.push(`Invalid role permissions: Permisi untuk role "${role.name || idx}" harus berupa Array.`);
                        } else {
                            role.permissions.forEach(perm => {
                                if (!this.validPermissions.includes(perm)) {
                                    errors.push(`Invalid permission: Permisi "${perm}" pada role "${role.name || idx}" tidak dikenal di Discord API.`);
                                }
                            });
                        }
                    }
                });
            }
        }

        // 4. Validate Categories
        if (template.categories) {
            if (!Array.isArray(template.categories)) {
                errors.push('Invalid categories: Field "categories" harus berupa Array.');
            } else {
                const seenCategoryNames = new Set();
                template.categories.forEach((cat, idx) => {
                    if (!cat.name) {
                        errors.push(`Missing category name: Kategori pada indeks ke-${idx} tidak memiliki nama.`);
                    } else {
                        if (seenCategoryNames.has(cat.name)) {
                            errors.push(`Duplicate category name: Nama kategori "${cat.name}" didefinisikan lebih dari satu kali.`);
                        }
                        seenCategoryNames.add(cat.name);
                    }
                });
            }
        }

        // 5. Validate Channels
        if (template.channels) {
            if (!Array.isArray(template.channels)) {
                errors.push('Invalid channels: Field "channels" harus berupa Array.');
            } else {
                const seenChannelPaths = new Set(); // Combination of "parent:name" to check duplicates within same category
                template.channels.forEach((chan, idx) => {
                    if (!chan.name) {
                        errors.push(`Missing channel name: Channel pada indeks ke-${idx} tidak memiliki nama.`);
                        return;
                    }
                    if (chan.type === undefined || chan.type === null) {
                        errors.push(`Missing channel type: Channel "${chan.name}" tidak memiliki tipe.`);
                    }

                    const parentKey = chan.parent || '_root';
                    const pathKey = `${parentKey}:${chan.name}`;
                    if (seenChannelPaths.has(pathKey)) {
                        errors.push(`Duplicate channel: Channel bernama "${chan.name}" di bawah kategori "${parentKey}" didefinisikan ganda.`);
                    }
                    seenChannelPaths.add(pathKey);

                    // Check if parent category exists in categories array (if parent is defined)
                    if (chan.parent && template.categories) {
                        const parentExists = template.categories.some(c => c.name === chan.parent);
                        if (!parentExists) {
                            errors.push(`Missing parent category: Channel "${chan.name}" merujuk ke kategori "${chan.parent}" yang tidak ada dalam daftar "categories".`);
                        }
                    }
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = new TemplateValidator();
