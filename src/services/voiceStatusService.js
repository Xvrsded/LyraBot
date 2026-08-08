const { ChannelType, PermissionFlagsBits } = require('discord.js');
const Order = require('../models/Order');
const StoreSetting = require('../models/StoreSetting');
const settingsService = require('./settingsService');
const logger = require('../utils/logger');

const QUEUE_CATEGORY_ID = '1456813672000262144';

// Target Names Generators
const getChannelNames = async () => {
    // 1. Antrian
    const activeCount = await Order.countDocuments({
        status: { $in: ['pending', 'paid', 'processing'] }
    });
    
    // 2. Fetch everything from central ConfigService
    const configService = require('./configService');
    const config = await configService.getGlobalConfig();
    
    const products = config.products || {};
    const isGigOpen = products.gift_in_game ? products.gift_in_game.enabled : true;
    const isSendOpen = products.robux_send ? products.robux_send.enabled : true;
    const isLoginOpen = products.robux_login ? products.robux_login.enabled : true;
    const isMMOpen = (products.mm_rekber && products.mm_rekber.status === 'OPEN');
    const isLimitedOpen = (!products.limited_item || products.limited_item.status === 'OPEN');
    
    // Payout setting is still in settingsService for now, unless migrated
    const isPayoutOpen = await settingsService.get('payout_enabled', true);
    
    const gigRate = config.gigRate || 90;
    const gigStock = config.gigStock || 0;
    const sendStock = config.sendStock || 0;
    
    const formatStock = (num) => {
        if (num <= 0) return 'HABIS';
        return num.toLocaleString('id-ID');
    };

    return [
        { key: 'queue', prefix: '🎫 | ANTRIAN:', name: `🎫 | ANTRIAN: ${activeCount}` },
        { key: 'gig', prefix: '🎁 | GIFT GAMEPASS:', name: `🎁 | GIFT GAMEPASS: ${isGigOpen ? '✅' : '❌'}` },
        { key: 'send', prefix: '⚡ | INSTANT SEND:', name: `⚡ | INSTANT SEND: ${isSendOpen ? '✅' : '❌'}` },
        { key: 'login', prefix: '📥 | VIA LOGIN:', name: `📥 | VIA LOGIN: ${isLoginOpen ? '✅' : '❌'}` },
        { key: 'payout', prefix: '💸 | GROUP PAYOUT:', name: `💸 | GROUP PAYOUT: ${isPayoutOpen ? '✅' : '❌'}` },
        { key: 'mm_rekber', prefix: '🛡️ | MM REKBER:', name: `🛡️ | MM REKBER: ${isMMOpen ? '✅' : '❌'}` },
        { key: 'limited_item', prefix: '💎 | LIMITED ITEM:', name: `💎 | LIMITED ITEM: ${isLimitedOpen ? '✅' : '❌'}` },
        { key: 'rate', prefix: '📊 | RATE:', name: `📊 | RATE: ${gigRate}` },
        { key: 'stock', prefix: '📦 | STOCK RBX GIG:', name: `📦 | STOCK RBX GIG: ${formatStock(gigStock)}` },
        { key: 'send_stock', prefix: '📦 | STOCK VIA SEND:', name: `📦 | STOCK VIA SEND: ${formatStock(sendStock)}` }
    ];
};

/**
 * Updates all Voice Channel Statuses in the category based on DB state.
 * @param {import('discord.js').Client} client 
 */
async function updateAllVoiceStatuses(client) {
    try {
        const category = await client.channels.fetch(QUEUE_CATEGORY_ID).catch(() => null);
        if (!category || category.type !== ChannelType.GuildCategory) {
            logger.warn(`[VoiceStatus] Category ${QUEUE_CATEGORY_ID} not found or is not a category.`);
            return;
        }

        const guild = category.guild;
        const targetNames = await getChannelNames();
        const existingChannels = category.children.cache.filter(c => c.type === ChannelType.GuildVoice);

        for (const target of targetNames) {
            // Check if we have a saved ID in settings for this specific key
            const settingsKey = `voice_status_id_${target.key}`;
            let channelId = await settingsService.get(settingsKey, null);
            let channel = null;

            if (channelId) {
                channel = existingChannels.get(channelId);
            }

            // Fallback: try to find by prefix if ID missing or invalid
            if (!channel) {
                channel = existingChannels.find(c => c.name.startsWith(target.prefix));
            }

            if (channel) {
                // Update existing channel
                await settingsService.set(settingsKey, channel.id);
                if (channel.name !== target.name) {
                    try {
                        await channel.setName(target.name);
                        logger.info(`[VoiceStatus] Updated: ${target.name}`);
                    } catch (err) {
                        logger.warn(`[VoiceStatus] Failed to rename ${channel.name} to ${target.name} (mungkin kena Rate Limit Discord). Error: ${err.message}`);
                    }
                }
            } else {
                // Create new channel
                const newChannel = await guild.channels.create({
                    name: target.name,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.Connect] // Prevent members from joining
                        }
                    ]
                });
                await settingsService.set(settingsKey, newChannel.id);
                logger.info(`[VoiceStatus] Created: ${target.name}`);
            }
        }
    } catch (error) {
        logger.error('[VoiceStatus] Error updating statuses:', error);
    }
}

module.exports = {
    updateAllVoiceStatuses
};
