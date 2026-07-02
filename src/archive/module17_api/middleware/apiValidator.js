/**
 * apiValidator.js — Centralized request validation middleware for Module 17.
 *
 * Schema format:
 *   {
 *     body:   { fieldName: 'type|modifier|modifier', ... },
 *     params: { ... },
 *     query:  { ... }
 *   }
 *
 * Supported types:   string, number, integer, boolean
 * Supported modifiers: required, optional, min:N, max:N, enum:a,b,c
 */

const { error } = require('../formatters/apiResponse');

/**
 * Returns Express middleware that validates the request against the schema.
 * @param {object} schema { body?, params?, query? }
 */
function validate(schema = {}) {
    return (req, res, next) => {
        const fieldErrors = [];

        for (const [source, fields] of Object.entries(schema)) {
            const data = req[source] || {};

            for (const [field, rule] of Object.entries(fields)) {
                const value  = data[field];
                const parts  = rule.split('|');
                const type   = parts[0];
                const mods   = parts.slice(1);

                const isRequired = mods.includes('required');
                const isOptional = mods.includes('optional') || !isRequired;

                // Missing check
                if (value === undefined || value === null || value === '') {
                    if (isRequired) {
                        fieldErrors.push({ field: `${source}.${field}`, issue: 'Wajib diisi.' });
                    }
                    continue;
                }

                // Type coercion & validation
                const coerced = _coerce(value, type);
                if (coerced === null) {
                    fieldErrors.push({ field: `${source}.${field}`, issue: `Tipe tidak valid. Diharapkan: ${type}.` });
                    continue;
                }

                // Apply modifiers
                for (const mod of mods) {
                    if (mod.startsWith('min:')) {
                        const min = Number(mod.slice(4));
                        if (typeof coerced === 'number' && coerced < min) {
                            fieldErrors.push({ field: `${source}.${field}`, issue: `Nilai minimum: ${min}.` });
                        }
                        if (typeof coerced === 'string' && coerced.length < min) {
                            fieldErrors.push({ field: `${source}.${field}`, issue: `Panjang minimum: ${min}.` });
                        }
                    }
                    if (mod.startsWith('max:')) {
                        const max = Number(mod.slice(4));
                        if (typeof coerced === 'number' && coerced > max) {
                            fieldErrors.push({ field: `${source}.${field}`, issue: `Nilai maksimum: ${max}.` });
                        }
                        if (typeof coerced === 'string' && coerced.length > max) {
                            fieldErrors.push({ field: `${source}.${field}`, issue: `Panjang maksimum: ${max}.` });
                        }
                    }
                    if (mod.startsWith('enum:')) {
                        const allowed = mod.slice(5).split(',');
                        if (!allowed.includes(String(coerced))) {
                            fieldErrors.push({ field: `${source}.${field}`, issue: `Nilai harus salah satu dari: ${allowed.join(', ')}.` });
                        }
                    }
                }

                // Write coerced value back
                req[source][field] = coerced;
            }
        }

        if (fieldErrors.length > 0) {
            return res.status(400).json(
                error('VALIDATION_ERROR', 'Input tidak valid.', fieldErrors, req.correlationId)
            );
        }

        next();
    };
}

/**
 * Attempts to coerce a value to the given type.
 * Returns null if coercion fails.
 * @private
 */
function _coerce(value, type) {
    switch (type) {
        case 'string':  return typeof value === 'string' ? value : String(value);
        case 'number':  { const n = Number(value); return isNaN(n) ? null : n; }
        case 'integer': { const i = parseInt(value, 10); return isNaN(i) ? null : i; }
        case 'boolean': {
            if (value === true || value === 'true' || value === 1 || value === '1') return true;
            if (value === false || value === 'false' || value === 0 || value === '0') return false;
            return null;
        }
        default: return value;
    }
}

module.exports = { validate };
