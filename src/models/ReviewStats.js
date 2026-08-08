const mongoose = require('mongoose');

const ReviewStatsSchema = new mongoose.Schema({
    id: { type: String, default: 'global', unique: true },
    totalReviews: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    stars: {
        5: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        1: { type: Number, default: 0 }
    }
});

module.exports = mongoose.model('ReviewStats', ReviewStatsSchema);
