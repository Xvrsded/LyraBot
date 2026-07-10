const mongoose = require('mongoose');

const GeneralSchema = new mongoose.Schema({
    prefix: { type: String, default: '!' },
    language: { type: String, default: 'id' }
}, { _id: false });

const ChannelsSchema = new mongoose.Schema({
    welcome: { type: String, default: null },
    goodbye: { type: String, default: null },
    logs: { type: String, default: null },
    tickets: { type: String, default: null },
    announcements: { type: String, default: null }
}, { _id: false });

const RolesSchema = new mongoose.Schema({
    admin: { type: String, default: null },
    moderator: { type: String, default: null },
    staff: { type: String, default: null },
    member: { type: String, default: null },
    muted: { type: String, default: null }
}, { _id: false });

const WelcomeSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    message: { type: String, default: '🎉 **Welcome to our community, {user}!**' },
    welcomeGif: { type: String, default: null },
    embed: { type: Boolean, default: true },
    autoRole: { type: String, default: null },
    verificationMode: { type: String, default: 'None' },
    restoreRoles: { type: Boolean, default: false }
}, { _id: false });

const LogsSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    messageDelete: { type: Boolean, default: true },
    messageUpdate: { type: Boolean, default: true },
    memberJoin: { type: Boolean, default: true },
    memberLeave: { type: Boolean, default: true },
    voiceStateUpdate: { type: Boolean, default: true }
}, { _id: false });

const ModerationSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    warnThreshold: { type: Number, default: 3 },
    actionOnThreshold: { type: String, default: 'mute' }
}, { _id: false });

const EconomySubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    currencyName: { type: String, default: 'Coin' },
    dailyAmount: { type: Number, default: 100 }
}, { _id: false });

const EventsSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    eventLogChannel: { type: String, default: null }
}, { _id: false });

const OwoSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    owoLogChannel: { type: String, default: null },
    autoVerify: { type: Boolean, default: false }
}, { _id: false });

const LevelSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    xpRate: { type: Number, default: 1 },
    levelUpMessage: { type: String, default: '🌟 **Selamat {user}, kamu naik ke level {level}!** 🌟' },
    levelUpChannel: { type: String, default: null }
}, { _id: false });

const QuestsSubSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    questChannel: { type: String, default: null }
}, { _id: false });

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    general: { type: GeneralSchema, default: () => ({}) },
    channels: { type: ChannelsSchema, default: () => ({}) },
    roles: { type: RolesSchema, default: () => ({}) },
    welcome: { type: WelcomeSubSchema, default: () => ({}) },
    logs: { type: LogsSubSchema, default: () => ({}) },
    moderation: { type: ModerationSubSchema, default: () => ({}) },
    economy: { type: EconomySubSchema, default: () => ({}) },
    events: { type: EventsSubSchema, default: () => ({}) },
    owo: { type: OwoSubSchema, default: () => ({}) },
    level: { type: LevelSubSchema, default: () => ({}) },
    quests: { type: QuestsSubSchema, default: () => ({}) }
}, { timestamps: true });

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
