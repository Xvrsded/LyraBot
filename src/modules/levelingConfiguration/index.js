const uiManager = require('../ui/services/uiManager');
const pageManager = require('../ui/services/pageManager');
const { EmbedBuilder } = require('discord.js');
const componentManager = require('../ui/services/componentManager');
const configManager = require('../configurationCenter/services/configCenterManager');
const eventBus = require('../../services/eventBus');

class LevelingConfigModule {
    init() {
        uiManager.registerPanel({
            id: 'leveling_config',
            title: 'Leveling Configuration',
            description: 'Pengaturan Sistem Leveling',
            icon: '⭐',
            permissions: ['ADMINISTRATOR'],
            pages: ['index']
        });

        // Handle the Toggle button click
        eventBus.subscribe('ui.action.leveling_config.toggle', async ({ interaction }) => {
            const guildId = interaction.guildId;
            const currentConfig = (await configManager.get(guildId, 'leveling')) || {};
            const isEnabled = currentConfig.enabled ?? true;
            
            // Toggle the state
            await configManager.set(guildId, 'leveling.enabled', !isEnabled);
            
            // Refresh the page
            await uiManager.navigation.navigate(interaction, 'leveling_config', 'index');
        }, 'levelingConfigModule');

        pageManager.registerPage('leveling_config', {
            id: 'index',
            render: async (sessionData, interaction) => {
                const guildId = interaction.guildId;
                const levelingConfig = (await configManager.get(guildId, 'leveling')) || {};
                const isEnabled = levelingConfig.enabled ?? true;

                const embed = new EmbedBuilder()
                    .setTitle('⭐ Leveling System Configuration')
                    .setDescription('Konfigurasikan sistem EXP, Level Up, dan Reward.')
                    .setColor('#FFD700')
                    .addFields({
                        name: 'Status Leveling',
                        value: isEnabled ? '🟢 **Aktif**' : '🔴 **Mati**',
                        inline: false
                    });

                const toggleBtn = componentManager.createButton({
                    id: 'ui:leveling_config:action:toggle',
                    label: isEnabled ? 'Matikan Leveling' : 'Nyalakan Leveling',
                    emoji: isEnabled ? '🛑' : '✅',
                    style: isEnabled ? 4 : 3 // Danger (4) if enabled, Success (3) if disabled
                });

                const backBtn = componentManager.createButton({
                    id: 'ui:configuration:nav:index', // Return to main config
                    label: 'Kembali',
                    emoji: '⬅️',
                    style: 2 // Secondary
                });
                
                const actionRow = componentManager.createActionRow([toggleBtn, backBtn]);

                return { embeds: [embed], components: [actionRow] };
            }
        });
    }
}
module.exports = new LevelingConfigModule();
