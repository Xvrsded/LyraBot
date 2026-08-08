const mongoose = require('mongoose');

const CopayEligibilitySchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true },
    discordUsername: { type: String, required: true },
    robloxUsername: { type: String, required: true },
    startedAt: { type: Date, required: true },
    eligibleAt: { type: Date, required: true },
    status: { type: String, enum: ['waiting', 'eligible'], default: 'waiting' },
    roleGranted: { type: Boolean, default: false },
    announcementSent: { type: Boolean, default: false },
    dmMessageId: { type: String, default: null } // Optional, to track if we need to edit a DM, though relative timestamp makes it less needed
}, { timestamps: true });

module.exports = mongoose.model('CopayEligibility', CopayEligibilitySchema);
