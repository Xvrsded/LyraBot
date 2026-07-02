const QuestProgress = require('../models/QuestProgress');
const QuestHistory = require('../models/QuestHistory');
const questRegistry = require('./questRegistry');
const eventBus = require('./eventBus');
const logger = require('../utils/logger');

class QuestEngine {
    constructor() {
        this.client = null;
    }

    /**
     * Initializes the quest engine, scans and registers all dynamic EventBus listeners.
     * @param {Client} client Discord Client object
     */
    init(client) {
        this.client = client;
        questRegistry.loadAll();

        // Register event listener for each unique event name in quest definitions
        const quests = questRegistry.getAllQuests();
        const uniqueEvents = Array.from(new Set(quests.map(q => q.event)));

        // ==========================================
        // Legacy Runtime (Disabled by Runtime Integration)
        // ==========================================
        /*
        for (const eventName of uniqueEvents) {
            eventBus.subscribe(eventName, async (ctx) => {
                try {
                    await this.handleQuestEvent(eventName, ctx);
                } catch (err) {
                    logger.error(`[QuestEngine] Failed to process quest updates for event "${eventName}":`, err.message);
                }
            }, 'quest-engine');
            logger.info(`[QuestEngine] Dynamically listening to quest trigger: "${eventName}"`);
        }
        */
    }

    /**
     * Processes progress updates against matching quests.
     * @private
     */
    async handleQuestEvent(eventName, ctx) {
        const guildId = ctx.guildId;
        const userId = ctx.userId;
        const payload = ctx.payload || {};

        if (!guildId || !userId) return;

        const matchingQuests = questRegistry.getQuestsForEvent(eventName);

        for (const quest of matchingQuests) {
            // 1. Evaluate conditions
            const match = this.evaluateConditions(quest.conditions, payload);
            if (!match) continue;

            // 2. Fetch or create progress entry
            let progress = await QuestProgress.findOne({ guildId, userId, questId: quest.id });
            if (progress && progress.completed) {
                // If repeatable quest is already completed & claimed, allow restart
                if (quest.repeatable && progress.claimed) {
                    progress.progress = 0;
                    progress.completed = false;
                    progress.claimed = false;
                    progress.startedAt = new Date();
                    progress.completedAt = null;
                } else {
                    continue; // Skip if already completed and not repeatable/claimed
                }
            }

            if (!progress) {
                progress = new QuestProgress({
                    guildId,
                    userId,
                    questId: quest.id,
                    target: quest.target,
                    progress: 0
                });
            }

            // 3. Increment progress
            progress.progress += 1;
            
            // Emit progress event
            eventBus.emit('quest.progress', {
                userId,
                questId: quest.id,
                progress: progress.progress,
                target: quest.target
            }, { plugin: 'quest', guildId, userId });

            // 4. Handle completion
            if (progress.progress >= quest.target) {
                progress.completed = true;
                progress.completedAt = new Date();

                logger.info(`[QuestEngine] Quest completed: "${quest.title}" (${quest.id}) for user ${userId}`);

                eventBus.emit('quest.completed', { userId, questId: quest.id }, { plugin: 'quest', guildId, userId });

                // Auto claim rewards immediately
                await this.awardRewards(guildId, userId, quest);
                progress.claimed = true;
            }

            await progress.save();
        }
    }

    /**
     * Checks if event payload matches quest constraints.
     * @private
     */
    evaluateConditions(conditions, payload) {
        if (!conditions || Object.keys(conditions).length === 0) return true;
        for (const [key, value] of Object.entries(conditions)) {
            if (payload[key] !== value) return false;
        }
        return true;
    }

    /**
     * Grants and resolves quest rewards automatically.
     * @private
     */
    async awardRewards(guildId, userId, quest) {
        try {
            const guild = this.client ? this.client.guilds.cache.get(guildId) : null;
            const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;

            for (const r of quest.rewards) {
                if (r.type === 'role' && member) {
                    const role = guild.roles.cache.get(r.roleId);
                    if (role) {
                        await member.roles.add(role, `Quest Reward: Completed "${quest.title}"`);
                        logger.info(`[QuestEngine] Awarded role "${role.name}" to ${userId}`);
                    }
                } else if (r.type === 'coins') {
                    const rewardDistributor = require('./rewardDistributor');
                    await rewardDistributor.reward(guildId, userId, r.amount, 'coins', 'quest-engine');
                } else if (r.type === 'xp') {
                    logger.info(`[QuestEngine] Awarded ${r.amount} XP to ${userId}`);
                }
            }

            // Save history record
            await QuestHistory.create({
                guildId,
                userId,
                questId: quest.id,
                title: quest.title,
                rewards: quest.rewards,
                completedAt: new Date()
            });

            eventBus.emit('quest.rewarded', { userId, questId: quest.id, rewards: quest.rewards }, { plugin: 'quest', guildId, userId });
        } catch (err) {
            logger.error(`[QuestEngine] Failed to award rewards for quest ${quest.id}:`, err.message);
        }
    }
}

module.exports = new QuestEngine();
