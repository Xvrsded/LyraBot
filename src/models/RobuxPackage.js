const mongoose = require('mongoose');

const RobuxPackageSchema = new mongoose.Schema({
    type: { type: String, enum: ['LOGIN', 'SEND', 'GIG', 'COPAY', 'vilog', 'visend', 'gig', 'copay', 'custom'], default: 'LOGIN' }, // Kept legacy enum values for safe migration
    label: { type: String, default: null }, // Optional text display (e.g., '150 Robux Custom')
    amount: { type: Number, required: true }, // Not unique globally because 500 vilog & 500 visend can coexist
    price: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }, // Soft delete flag
    displayOrder: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 } // Legacy sorting
}, { timestamps: true });

// Prevent duplicate amounts within the same package type
RobuxPackageSchema.index({ type: 1, amount: 1 }, { unique: true });

module.exports = mongoose.model('RobuxPackage', RobuxPackageSchema);
