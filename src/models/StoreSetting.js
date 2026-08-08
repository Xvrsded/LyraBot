const mongoose = require('mongoose');

const storeSettingSchema = new mongoose.Schema({
    dashboardMessageId: {
        type: String,
        default: null
    },
    dashboardChannelId: {
        type: String,
        default: null
    },
    updatedBy: {
        type: String,
        default: 'System'
    },
    products: {
        robux_login: {
            enabled: { type: Boolean, default: true }
        },
        robux_send: {
            enabled: { type: Boolean, default: true }
        },
        gift_in_game: {
            enabled: { type: Boolean, default: true }
        },
        mm_rekber: {
            status: { type: String, enum: ['OPEN', 'CLOSE'], default: 'OPEN' }
        },
        limited_item: {
            status: { type: String, enum: ['OPEN', 'CLOSE'], default: 'OPEN' }
        }
    },
    // Live Inventory
    gigStock: { type: Number, default: 0 },
    sendStock: { type: Number, default: 0 },
    // Rates
    gigRate: { type: Number, default: 0 },
    // Auto Update Trackers
    panelMessageIds: {
        LOGIN: { type: String, default: null },
        SEND: { type: String, default: null },
        GIG: { type: String, default: null },
        COPAY: { type: String, default: null },
        MM: { type: String, default: null },
        LIMITED: { type: String, default: null }
    },
    // Config Versioning
    configVersion: { type: Number, default: 1 },
    lastUpdatedBy: { type: String, default: 'System' },
    lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('StoreSetting', storeSettingSchema);
