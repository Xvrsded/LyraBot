const PricelistCategory = require('../models/PricelistCategory');
const StoreSetting = require('../models/StoreSetting');
const configService = require('./configService');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

class PricelistService {
    /**
     * Get active rate for automatic pricelist calculation
     */
    async getRate() {
        const config = await configService.getGlobalConfig();
        return config.gigRateIndo || config.gigRateGlobal || config.gigRate || 90;
    }

    /**
     * Calculate price for robux amount using rate and 500 rounding
     */
    calculatePrice(robux, rate, customPrice = null) {
        if (customPrice && Number(customPrice) > 0) {
            return Number(customPrice);
        }
        const raw = (Number(robux) || 0) * (Number(rate) || 90);
        return Math.ceil(raw / 500) * 500;
    }

    /**
     * Fetch all active categories
     */
    async getAllCategories() {
        return await PricelistCategory.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 });
    }

    /**
     * Find category by categoryId
     */
    async getCategory(categoryId) {
        return await PricelistCategory.findOne({ categoryId });
    }

    /**
     * Create a new category
     */
    async createCategory({ buttonLabel, buttonEmoji = '📋', title, description = '', color = '#3b82f6' }) {
        const categoryId = `cat_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const count = await PricelistCategory.countDocuments();
        return await PricelistCategory.create({
            categoryId,
            buttonLabel,
            buttonEmoji,
            title,
            description,
            color,
            displayOrder: count,
            items: []
        });
    }

    /**
     * Delete a category
     */
    async deleteCategory(categoryId) {
        return await PricelistCategory.findOneAndDelete({ categoryId });
    }

    /**
     * Add a gamepass item to category
     */
    async addItem(categoryId, { name, robux, customPrice = null }) {
        const category = await this.getCategory(categoryId);
        if (!category) throw new Error('Kategori tidak ditemukan.');

        category.items.push({
            name,
            robux: Number(robux),
            customPrice: customPrice ? Number(customPrice) : null
        });
        await category.save();
        return category;
    }

    /**
     * Remove an item from category by index
     */
    async removeItem(categoryId, index) {
        const category = await this.getCategory(categoryId);
        if (!category) throw new Error('Kategori tidak ditemukan.');

        if (index >= 0 && index < category.items.length) {
            category.items.splice(index, 1);
            await category.save();
        }
        return category;
    }

    /**
     * Build the public overview panel (Embed + Category Buttons)
     */
    async buildPublicPanel() {
        const categories = await this.getAllCategories();
        const rate = await this.getRate();

        const mainEmbed = new EmbedBuilder()
            .setTitle('📋 DAFTAR HARGA / PRICELIST GAMEPASS')
            .setDescription(
                `Selamat datang di **Pricelist Resmi LyraBlox**!\n\n` +
                `⚡ **Informasi Kurs / Rate:** \`Rp ${rate} / Robux\`\n` +
                `✨ Harga pada setiap item di bawah ini dihitung otomatis mengikuti rate aktif.\n\n` +
                `👇 **Silakan klik tombol kategori di bawah ini untuk melihat daftar harga gamepass yang tersedia:**`
            )
            .setColor('#3b82f6')
            .setFooter({ text: 'LyraBlox • Daftar Harga Otomatis' })
            .setTimestamp();

        const rows = [];
        if (categories.length > 0) {
            let currentRow = new ActionRowBuilder();
            for (let i = 0; i < categories.length; i++) {
                if (currentRow.components.length >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                const cat = categories[i];
                const btn = new ButtonBuilder()
                    .setCustomId(`pricelist_view_${cat.categoryId}`)
                    .setLabel(cat.buttonLabel.substring(0, 80))
                    .setStyle(ButtonStyle.Primary);
                
                if (cat.buttonEmoji) {
                    try {
                        btn.setEmoji(cat.buttonEmoji);
                    } catch (e) {
                        // ignore invalid emoji format
                    }
                }
                currentRow.addComponents(btn);
            }
            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }
        }

        return { embeds: [mainEmbed], components: rows };
    }

    /**
     * Build specific category's detail embed
     */
    async buildCategoryEmbed(category) {
        const rate = await this.getRate();

        const embed = new EmbedBuilder()
            .setTitle(`${category.buttonEmoji ? category.buttonEmoji + ' ' : ''}${category.title}`)
            .setColor(category.color || '#3b82f6')
            .setTimestamp()
            .setFooter({ text: `Rate: Rp ${rate}/Robux • LyraBlox Official Pricelist` });

        if (category.description) {
            embed.setDescription(category.description + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }

        if (!category.items || category.items.length === 0) {
            embed.addFields({
                name: 'ℹ️ Belum Ada Item',
                value: 'Belum ada daftar gamepass yang dimasukkan ke dalam kategori ini.',
                inline: false
            });
            return embed;
        }

        // Add items as fields or formatted list
        let textList = '';
        category.items.forEach((item, idx) => {
            const price = this.calculatePrice(item.robux, rate, item.customPrice);
            textList += `**${idx + 1}. ${item.name}**\n` +
                        `• Robux: \`${item.robux.toLocaleString('id-ID')} R$\`\n` +
                        `• Harga: \`Rp ${price.toLocaleString('id-ID')}\`\n\n`;
        });

        // Split textList into chunks if needed (> 4000 chars)
        if (textList.length <= 4000) {
            embed.setDescription((category.description ? category.description + '\n\n' : '') + textList);
        } else {
            // Put in chunks
            const chunks = textList.match(/[\s\S]{1,1024}/g) || [];
            chunks.forEach((chunk, i) => {
                embed.addFields({ name: i === 0 ? '📦 Daftar Gamepass' : '\u200b', value: chunk, inline: false });
            });
        }

        return embed;
    }

    /**
     * Publish or update the panel in target channel (default: 1562746683081752648)
     */
    async publishPanel(client, targetChannelId = '1562746683081752648') {
        const channel = await client.channels.fetch(targetChannelId).catch(() => null);
        if (!channel) throw new Error(`Channel dengan ID ${targetChannelId} tidak ditemukan atau bot tidak memiliki akses.`);

        const panelData = await this.buildPublicPanel();
        const setting = await StoreSetting.findOne() || await StoreSetting.create({});

        let message = null;
        if (setting.pricelistMessageId) {
            message = await channel.messages.fetch(setting.pricelistMessageId).catch(() => null);
        }

        if (message) {
            await message.edit(panelData);
        } else {
            message = await channel.send(panelData);
            setting.pricelistMessageId = message.id;
        }

        setting.pricelistChannelId = targetChannelId;
        await setting.save();

        logger.info(`[PricelistService] Published/updated pricelist panel in channel ${targetChannelId}`);
        return { success: true, messageId: message.id, channelId: targetChannelId };
    }
}

module.exports = new PricelistService();
