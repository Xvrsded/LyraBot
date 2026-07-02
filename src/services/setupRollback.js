const logger = require('../utils/logger');

class SetupRollback {
    /**
     * Reverts all creations (deletes roles & channels/categories) performed during setup execution.
     * @param {Guild} guild Discord Guild object
     * @param {object} context Setup execution context containing created IDs
     * @returns {Promise<{ channelsDeleted: number, rolesDeleted: number, errors: string[] }>}
     */
    async executeRollback(guild, context) {
        logger.warn(`[SetupRollback] Initializing rollback for guild "${guild.name}"...`);
        const report = {
            channelsDeleted: 0,
            rolesDeleted: 0,
            errors: []
        };

        if (!context || !context.rollback) {
            logger.info('[SetupRollback] Nothing to rollback.');
            return report;
        }

        // 1. Delete created channels and categories (reverse order to delete channels before their parent categories)
        const channelsToRollback = [...context.rollback.channels].reverse();
        for (const channelId of channelsToRollback) {
            try {
                const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
                if (channel && channel.deletable) {
                    await channel.delete('Setup rollback due to execution error');
                    report.channelsDeleted++;
                    logger.info(`[SetupRollback] Deleted channel: "${channel.name}" (${channelId})`);
                }
            } catch (err) {
                const msg = `Gagal menghapus channel ${channelId}: ${err.message}`;
                logger.error(`[SetupRollback] ${msg}`);
                report.errors.push(msg);
            }
            // Delay slightly to prevent spam/rate-limiting
            await new Promise(r => setTimeout(r, 200));
        }

        // 2. Delete created roles
        for (const roleId of context.rollback.roles) {
            try {
                const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
                if (role && role.editable) {
                    await role.delete('Setup rollback due to execution error');
                    report.rolesDeleted++;
                    logger.info(`[SetupRollback] Deleted role: "${role.name}" (${roleId})`);
                }
            } catch (err) {
                const msg = `Gagal menghapus role ${roleId}: ${err.message}`;
                logger.error(`[SetupRollback] ${msg}`);
                report.errors.push(msg);
            }
            await new Promise(r => setTimeout(r, 200));
        }

        logger.info(`[SetupRollback] Rollback finished: deleted ${report.channelsDeleted} channels and ${report.rolesDeleted} roles.`);
        return report;
    }
}

module.exports = new SetupRollback();
