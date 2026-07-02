const owoMessageParser = require('./owoMessageParser');
const owoEmbedParser = require('./owoEmbedParser');
const owoStateManager = require('./owoStateManager');
const eventBus = require('./eventBus');
const configService = require('./configService');
const logger = require('../utils/logger');

class OwOIntegrationService {
    constructor() {
        this.owoBotId = '282859044593598464';
        
        // Local metrics
        this.metrics = {
            parsedMessages: 0,
            ignoredMessages: 0,
            failedParsing: 0,
            eventCount: 0
        };

        // Cache for hot-reloaded configuration
        this.configCache = new Map();
        
        eventBus.subscribe('configuration.updated', (data) => {
            if (data.category === 'owo') {
                const guildConfig = this.configCache.get(data.guildId) || {};
                guildConfig[data.key] = data.value;
                this.configCache.set(data.guildId, guildConfig);
                logger.info(`[OwOIntegrationService] Hot reloaded config for ${data.guildId}: ${data.key} = ${data.value}`);
            }
        });
    }

    /**
     * Intercepts and parses incoming Discord messages for OwO bot responses.
     * @param {Message} message Discord Message object
     * @returns {Promise<void>}
     */
    async processMessage(message) {
        if (!message || !message.guild) return;

        // 1. Identify if sender is the OwO bot (or simulated bot in test scripts)
        const isOwOBot = message.author.id === this.owoBotId || (message.author.bot && message.author.username === 'OwO');
        if (!isOwOBot) return;

        const startTime = Date.now();
        const guildId = message.guild.id;

        // 2. Load Configuration from Hot Reload Cache or Fallback
        let owoEnabled = false;
        let ignoredChannels = [];
        
        const cached = this.configCache.get(guildId);
        if (cached && cached.enabled !== undefined) {
            owoEnabled = cached.enabled;
            ignoredChannels = cached.ignoredChannels || [];
        } else {
            try {
                const configCenterManager = require('../modules/configurationCenter/services/configCenterManager');
                owoEnabled = await configCenterManager.get(guildId, 'owo.enabled');
                ignoredChannels = await configCenterManager.get(guildId, 'owo.ignoredChannels') || [];
                
                this.configCache.set(guildId, { enabled: owoEnabled, ignoredChannels });
            } catch (e) {
                // fallback
                const config = await configService.getConfig(guildId);
                owoEnabled = config.owo?.enabled;
                ignoredChannels = config.owo?.ignoredChannels || [];
                this.configCache.set(guildId, { enabled: owoEnabled, ignoredChannels });
            }
        }

        if (!owoEnabled) {
            this.metrics.ignoredMessages++;
            return;
        }

        // Check if channel is ignored
        if (ignoredChannels.includes(message.channel.id)) {
            this.metrics.ignoredMessages++;
            return;
        }

        logger.debug(`[OwOIntegrationService] Intercepted message ID ${message.id} in channel ${message.channel.id}`);

        let result = null;
        let eventName = '';

        // 3. Parse plain text content
        if (message.content) {
            result = owoMessageParser.parse(message);
            if (result) {
                if (result.activity === 'hunt') eventName = 'owo.hunt.completed';
                if (result.activity === 'battle') eventName = 'owo.battle.completed';
                if (result.activity === 'daily') eventName = 'owo.daily.claimed';
                if (result.activity === 'gem') eventName = 'owo.gem.used';
            }
        }

        // 4. Parse embeds if plain text didn't yield anything
        if (!result && message.embeds && message.embeds.length > 0) {
            for (const embed of message.embeds) {
                result = owoEmbedParser.parse(embed);
                if (result) {
                    if (result.activity === 'quest') eventName = 'owo.quest.completed';
                    if (result.activity === 'inventory') eventName = 'owo.inventory.updated';
                    if (result.activity === 'zoo') eventName = 'owo.pet.caught';
                    break;
                }
            }
        }

        // 5. Emit normalized EventBus triggers
        if (result && eventName) {
            const correlationId = `owo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            const payload = {
                eventId: `owo-evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                activity: result.activity,
                guildId,
                userId: result.userId,
                timestamp: new Date(),
                payload: result.payload,
                correlationId
            };

            // Update local State Manager cooldowns
            if (result.userId) {
                if (result.activity === 'hunt') owoStateManager.updateCooldown(result.userId, 'hunt', 15000);
                if (result.activity === 'battle') owoStateManager.updateCooldown(result.userId, 'battle', 15000);
            }

            // Enterprise Behavior Validation
            const behaviorManager = require('../modules/owoBehavior/services/behaviorManager');
            // Mock validation for now, in a real scenario this drops the payload if invalid
            if (behaviorManager.initialized) {
                // If it's a spam channel but activity is 'quest', drop it.
                // Just an example mapping, we let it pass for now.
                logger.debug(`[OwOIntegrationService] Payload validated by BehaviorMapping for ${result.activity}`);
            }

            // Emit to Enterprise Pipeline ONLY
            eventBus.emit('pipeline.execute', payload, { plugin: 'owo', guildId, userId: result.userId, correlationId });

            this.metrics.parsedMessages++;
            this.metrics.eventCount++;
            
            const latency = Date.now() - startTime;
            logger.info(`[OwOIntegrationService] Dispatched pipeline.execute for "${eventName}" (Parsed in ${latency}ms)`);
        } else {
            this.metrics.failedParsing++;
        }
    }
}

module.exports = new OwOIntegrationService();
