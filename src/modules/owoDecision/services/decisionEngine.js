const ruleEvaluator = require('./ruleEvaluator');
const alertEngine = require('./alertEngine');
const recommendationEngine = require('./recommendationEngine');
const reminderEngine = require('./reminderEngine');
const decisionMetrics = require('./decisionMetrics');
const eventBus = require('../../../services/eventBus');
const logger = require('../../../utils/logger');

class DecisionEngine {
    constructor() {
        this.rules = [];
    }

    loadRules(ruleSets) {
        this.rules = ruleSets.flat();
    }

    registerRule(rule) {
        this.rules.push(rule);
    }

    async evaluate(trigger, context, payload) {
        const matchingRules = this.rules.filter(r => r.trigger === trigger);

        for (const rule of matchingRules) {
            const isMatch = ruleEvaluator.evaluate(rule.condition, payload);
            decisionMetrics.recordEvaluation(isMatch);

            if (isMatch) {
                eventBus.emit('decision.rule.matched', { ruleId: rule.id, trigger });
                await this._executeAction(rule.action, context);
            }
        }
    }

    async _executeAction(action, context) {
        try {
            switch (action.type) {
                case 'raise_alert':
                    alertEngine.raiseAlert(context, action.message, action.level);
                    break;
                case 'recommend':
                    recommendationEngine.recommend(context, action.message);
                    break;
                case 'schedule_reminder':
                    reminderEngine.scheduleReminder(context, action.message, action.delay);
                    break;
                case 'notify_reward':
                    // just an example of custom action logging
                    decisionMetrics.recordAction('notify_reward');
                    break;
                default:
                    logger.warn(`[DecisionEngine] Unknown action type: ${action.type}`);
                    break;
            }
            eventBus.emit('decision.executed', { action, context });
        } catch (error) {
            decisionMetrics.recordFailure();
            logger.error(`[DecisionEngine] Action ${action.type} failed:`, error);
            eventBus.emit('decision.failed', { action, error: error.message, context });
        }
    }
}

module.exports = new DecisionEngine();
