const { ButtonBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, EmbedBuilder } = require('discord.js');

/**
 * Wraps discord.js builders to decouple modules from direct DJS imports.
 */
class ComponentManager {
    createButton(config) {
        const btn = new ButtonBuilder()
            .setCustomId(config.id)
            .setLabel(config.label || 'Button')
            .setStyle(config.style || 1); // 1 = Primary, 2 = Secondary, 3 = Success, 4 = Danger
        
        if (config.emoji) btn.setEmoji(config.emoji);
        if (config.disabled) btn.setDisabled(config.disabled);
        
        return btn;
    }

    createSelectMenu(config) {
        const select = new StringSelectMenuBuilder()
            .setCustomId(config.id)
            .setPlaceholder(config.placeholder || 'Make a selection...');
        
        if (config.minValues) select.setMinValues(config.minValues);
        if (config.maxValues) select.setMaxValues(config.maxValues);
        if (config.disabled) select.setDisabled(config.disabled);

        if (config.options && Array.isArray(config.options)) {
            const options = config.options.map(opt => {
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(opt.label)
                    .setValue(opt.value);
                
                if (opt.description) option.setDescription(opt.description);
                if (opt.emoji) option.setEmoji(opt.emoji);
                if (opt.default) option.setDefault(opt.default);
                
                return option;
            });
            select.addOptions(options);
        }

        return select;
    }

    createModal(config) {
        const modal = new ModalBuilder()
            .setCustomId(config.id)
            .setTitle(config.title || 'Modal Form');
        
        if (config.inputs && Array.isArray(config.inputs)) {
            const rows = config.inputs.map(input => {
                const textInput = new TextInputBuilder()
                    .setCustomId(input.id)
                    .setLabel(input.label)
                    .setStyle(input.style || 1) // 1 = Short, 2 = Paragraph
                    .setRequired(input.required !== false);
                
                if (input.placeholder) textInput.setPlaceholder(input.placeholder);
                if (input.value) textInput.setValue(input.value);
                if (input.minLength) textInput.setMinLength(input.minLength);
                if (input.maxLength) textInput.setMaxLength(input.maxLength);
                
                return new ActionRowBuilder().addComponents(textInput);
            });
            modal.addComponents(rows);
        }
        
        return modal;
    }

    createEmbed(config) {
        const embed = new EmbedBuilder();
        if (config.title) embed.setTitle(config.title);
        if (config.description) embed.setDescription(config.description);
        if (config.color) embed.setColor(config.color);
        if (config.fields) embed.addFields(config.fields);
        if (config.thumbnail) embed.setThumbnail(config.thumbnail);
        if (config.image) embed.setImage(config.image);
        if (config.author) embed.setAuthor(config.author);
        if (config.footer) embed.setFooter(config.footer);
        if (config.timestamp) embed.setTimestamp();
        
        return embed;
    }

    createActionRow(components) {
        return new ActionRowBuilder().addComponents(components);
    }
}

module.exports = new ComponentManager();
