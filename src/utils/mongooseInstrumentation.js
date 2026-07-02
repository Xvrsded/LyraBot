const mongoose = require('mongoose');

module.exports = {
    /**
     * Attaches global hooks to all Mongoose schemas to count queries automatically.
     */
    instrument() {
        mongoose.plugin((schema) => {
            // Intercept standard query hooks
            schema.pre(['find', 'findOne', 'findOneAndUpdate', 'updateOne', 'deleteOne', 'countDocuments', 'aggregate'], function(next) {
                try {
                    const metricsService = require('../services/metricsService');
                    metricsService.recordMongoQuery();
                } catch (e) {
                    // Fail silently to avoid interrupting database calls
                }
                next();
            });

            // Intercept save operations (document creation/modifications)
            schema.pre('save', function(next) {
                try {
                    const metricsService = require('../services/metricsService');
                    metricsService.recordMongoQuery();
                } catch (e) {
                    // Fail silently
                }
                next();
            });
        });
    }
};
