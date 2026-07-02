const MemberProgression = require('../models/MemberProgression');
const AchievementProgress = require('../models/AchievementProgress');
const achievementRegistry = require('./achievementRegistry');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

class ProgressionEngine {
    constructor() {
        this.client = null;
    }

    /**
     * Initializes the progression and achievement engine.
     * @param {Client} client Discord Client object
     */
    init(client) {
        this.client = client;
        achievementRegistry.loadAll();

        const achievements = achievementRegistry.getAllAchievements();
        const uniqueEvents = Array.from(new Set(achievements.map(a => a.event)));

        this.xpMultiplierCache = {};
        
        // Listen for configuration updates to hot reload XP multipliers
        eventBus.subscribe('configuration.updated', (data) => {
            if (data.category === 'leveling') {
                this.xpMultiplierCache[data.guildId] = data.value;
                logger.info(`[ProgressionEngine] Hot reloaded leveling config for ${data.guildId}`);
            }
        });
    }

    /**
     * Intercepts event data, awards XP, and updates matching achievement counters.
     * @private
     */
    async handleAchievementEvent(eventName, ctx) {
        const guildId = ctx.guildId;
        const userId = ctx.userId;
        const payload = ctx.payload || {};

        if (!guildId || !userId) return;

        // 1. Fetch or initialize Member Progression record
        let progression = await MemberProgression.findOne({ guildId, userId });
        if (!progression) {
            progression = new MemberProgression({
                guildId,
                userId,
                xp: 0,
                level: 1,
                achievementPoints: 0,
                badges: [],
                titles: []
            });
        }

        // 2. Fetch runtime configuration from Module 22.5
        let baseXP = 15;
        try {
            if (this.xpMultiplierCache && this.xpMultiplierCache[guildId]) {
                const configValue = this.xpMultiplierCache[guildId];
                baseXP = configValue.multiplier ? 15 * configValue.multiplier : 15;
            } else {
                const configCenterManager = require('../modules/configurationCenter/services/configCenterManager');
                const xpConfig = await configCenterManager.get(guildId, 'leveling');
                if (xpConfig && xpConfig.multiplier) {
                    baseXP = 15 * xpConfig.multiplier;
                }
            }
        } catch (e) {
            logger.warn('[ProgressionEngine] Could not fetch XP config, defaulting to 15');
        }

        // Grant dynamic XP on activity triggers
        progression.xp += baseXP; 
        const xpNeeded = progression.level * 100;
        if (progression.xp >= xpNeeded) {
            progression.xp -= xpNeeded;
            progression.level += 1;
            logger.info(`[ProgressionEngine] User ${userId} leveled up to Level ${progression.level}!`);
            
            // Dispatch level up event
            eventBus.emit('progression.level_up', { userId, level: progression.level }, { plugin: 'progression', guildId, userId });
        }

        // 3. Process achievements
        const matchingAchievements = achievementRegistry.getAchievementsForEvent(eventName);

        for (const ach of matchingAchievements) {
            const match = this.evaluateConditions(ach.conditions, payload);
            if (!match) continue;

            let progress = await AchievementProgress.findOne({ guildId, userId, achievementId: ach.id });
            if (progress && progress.completed) {
                continue; // Skip if already completed (achievements are typically lifetime one-shot milestones)
            }

            if (!progress) {
                progress = new AchievementProgress({
                    guildId,
                    userId,
                    achievementId: ach.id,
                    target: ach.target,
                    progress: 0
                });
            }

            // Increment progress
            progress.progress += 1;

            if (progress.progress >= ach.target) {
                progress.completed = true;
                progress.unlockedAt = new Date();

                logger.info(`[ProgressionEngine] Achievement unlocked: "${ach.title}" (${ach.id}) for user ${userId}`);

                // Award Rewards
                progression.achievementPoints += ach.points;
                
                for (const r of ach.rewards) {
                    if (r.type === 'badge') {
                        if (!progression.badges.includes(r.badge)) {
                            progression.badges.push(r.badge);
                            eventBus.emit('badge.earned', { userId, badge: r.badge }, { plugin: 'progression', guildId, userId });
                        }
                    } else if (r.type === 'title') {
                        if (!progression.titles.includes(r.title)) {
                            progression.titles.push(r.title);
                            eventBus.emit('title.unlocked', { userId, title: r.title }, { plugin: 'progression', guildId, userId });
                        }
                    } else if (r.type === 'role') {
                        const guild = this.client ? this.client.guilds.cache.get(guildId) : null;
                        const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
                        const role = guild ? guild.roles.cache.get(r.roleId) : null;
                        if (member && role) {
                            await member.roles.add(role, `Achievement Unlocked: "${ach.title}"`).catch(() => null);
                        }
                    } else if (r.type === 'coins') {
                        const rewardDistributor = require('./rewardDistributor');
                        await rewardDistributor.reward(guildId, userId, r.amount, 'coins', 'progression-engine').catch(err => {
                            logger.error(`[ProgressionEngine] Failed to award coins reward: ${err.message}`);
                        });
                    }
                }

                // Emit Unlock Event
                eventBus.emit('achievement.unlocked', { userId, achievementId: ach.id, points: ach.points }, { plugin: 'progression', guildId, userId });
            }

            await progress.save();
        }

        await progression.save();
    }

    /**
     * Checks if event payload matches achievement constraints.
     * @private
     */
    evaluateConditions(conditions, payload) {
        if (!conditions || Object.keys(conditions).length === 0) return true;
        for (const [key, value] of Object.entries(conditions)) {
            if (payload[key] !== value) return false;
        }
        return true;
    }
}

module.exports = new ProgressionEngine();
