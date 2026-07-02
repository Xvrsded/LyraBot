const mongoose = require('mongoose');

const DecisionHistorySchema = new mongoose.Schema({
    correlationId: { type: String, required: true },
    ruleId: { type: String, required: true },
    trigger: { type: String, required: true },
    actionExecuted: { type: Object, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DecisionHistory', DecisionHistorySchema);
