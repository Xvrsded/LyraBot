const OwODiscoveryState = require('../models/OwODiscoveryState');
const channelDiscovery = require('./channelDiscovery');
const roleDiscovery = require('./roleDiscovery');
const logger = require('../../../utils/logger');

class MigrationDetector {
    /**
     * Scans a server to see if it has existing configured channels before setup.
     * Prevents WinterBot from duplicating channels if they already exist.
     */
    async detect(guild) {
        if (!guild) return false;

        let state = await OwODiscoveryState.findOne({ guildId: guild.id });
        if (!state) {
            state = new OwODiscoveryState({ guildId: guild.id });
        }

        // If already migrated, skip
        if (state.migrated) return true;

        logger.info(`[MigrationDetector] Scanning guild ${guild.id} for existing channels/roles...`);
        
        const channelsMapped = await channelDiscovery.scanGuild(guild);
        const rolesMapped = await roleDiscovery.scanGuild(guild);

        if (channelsMapped > 0 || rolesMapped > 0) {
            logger.info(`[MigrationDetector] Found ${channelsMapped} channels and ${rolesMapped} roles. Migration complete.`);
            state.migrated = true;
            state.lastScan = new Date();
            await state.save();
            return true;
        }

        return false;
    }
}

module.exports = new MigrationDetector();
