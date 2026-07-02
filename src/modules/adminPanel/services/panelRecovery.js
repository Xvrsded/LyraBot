const panelPersistence = require('./panelPersistence');
const panelInstaller = require('./panelInstaller');
const logger = require('../../../utils/logger');
const eventBus = require('../../../services/eventBus');

class PanelRecovery {
    /**
     * Scans all saved panel states and recovers missing/broken ones.
     */
    async scanAndRecover(client) {
        logger.info('[PanelRecovery] Starting scan for broken admin panels...');
        try {
            const states = await panelPersistence.getAllStates();
            let recoveredCount = 0;

            for (const state of states) {
                const guild = await client.guilds.fetch(state.guildId).catch(() => null);
                if (!guild) continue; // Bot might have left the guild, skip

                const channel = await guild.channels.fetch(state.channelId).catch(() => null);
                let needsRecovery = false;

                if (!channel) {
                    needsRecovery = true;
                } else {
                    const message = await channel.messages.fetch(state.messageId).catch(() => null);
                    if (!message) {
                        needsRecovery = true;
                    } else {
                        // The panel exists, but we want to auto-update it with the latest buttons/layout
                        const panelUpdater = require('./panelUpdater');
                        await panelUpdater.updatePanel(client, state.guildId);
                    }
                }

                if (needsRecovery) {
                    logger.warn(`[PanelRecovery] Broken panel detected in guild ${state.guildId}. Initiating recovery...`);
                    await panelPersistence.setRecoveryStatus(state.guildId, 'PENDING');
                    
                    const success = await panelInstaller.install(guild, state.currentTemplate);
                    
                    if (success) {
                        recoveredCount++;
                        eventBus.emit('panel.recovered', { guildId: state.guildId });
                    } else {
                        await panelPersistence.setRecoveryStatus(state.guildId, 'FAILED');
                        logger.error(`[PanelRecovery] Failed to recover panel in guild ${state.guildId}.`);
                    }
                }
            }
            logger.info(`[PanelRecovery] Scan complete. Recovered ${recoveredCount} panels.`);
        } catch (error) {
            logger.error('[PanelRecovery] Error during scan:', error);
        }
    }
}

module.exports = new PanelRecovery();
