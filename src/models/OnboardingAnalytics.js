const mongoose = require('mongoose');

const OnboardingAnalyticsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    joins: {
        type: Number,
        default: 0
    },
    leaves: {
        type: Number,
        default: 0
    },
    verifiedCount: {
        type: Number,
        default: 0
    },
    totalVerificationTimeMs: {
        type: Number,
        default: 0 // Combined verification durations for averaging
    },
    date: {
        type: String, // YYYY-MM-DD format
        required: true
    }
}, { timestamps: true });

OnboardingAnalyticsSchema.index({ guildId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('OnboardingAnalytics', OnboardingAnalyticsSchema);
