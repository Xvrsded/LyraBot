const mongoose = require('mongoose');

const DashboardSettingSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    type: { type: String, required: true, default: 'control_center' }
}, { timestamps: true });

module.exports = mongoose.model('DashboardSetting', DashboardSettingSchema);
