const _ = require('lodash');

class RuleEvaluator {
    evaluate(condition, payload) {
        if (!condition) return true; // No condition = always match
        
        const { operator, field, value } = condition;
        const targetValue = _.get(payload, field);

        switch (operator) {
            case 'eq': return targetValue === value;
            case 'neq': return targetValue !== value;
            case 'gt': return targetValue > value;
            case 'lt': return targetValue < value;
            case 'gte': return targetValue >= value;
            case 'lte': return targetValue <= value;
            case 'includes': return Array.isArray(targetValue) && targetValue.includes(value);
            case 'exists': return targetValue !== undefined && targetValue !== null;
            default: return false;
        }
    }
}

module.exports = new RuleEvaluator();
