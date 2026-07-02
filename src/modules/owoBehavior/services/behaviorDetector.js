const channelBehaviors = require('../registry/channelBehaviors.json');
const categoryBehaviors = require('../registry/categoryBehaviors.json');
const roleBehaviors = require('../registry/roleBehaviors.json');

class BehaviorDetector {
    /**
     * Determines the closest matching behavior ID for a given string based on aliases.
     * Tries Exact -> Substring/Alias Match.
     */
    _detect(name, registry) {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();

        // Pass 1: Exact Match on keys
        if (registry[normalized]) return normalized;

        // Pass 2: Alias exact or inclusion match
        for (const [behaviorId, data] of Object.entries(registry)) {
            if (!data.aliases) continue;
            
            for (const alias of data.aliases) {
                const normAlias = alias.toLowerCase();
                // Check if the normalized name strictly equals or includes the alias
                // or if the alias includes the normalized name. 
                // Using substring matching to handle things like "🦝・hunt" -> "hunt"
                if (normalized === normAlias || normalized.includes(normAlias)) {
                    return behaviorId;
                }
            }
        }

        return null;
    }

    detectChannel(channelName) {
        return this._detect(channelName, channelBehaviors);
    }

    detectCategory(categoryName) {
        return this._detect(categoryName, categoryBehaviors);
    }

    detectRole(roleName) {
        return this._detect(roleName, roleBehaviors);
    }
}

module.exports = new BehaviorDetector();
