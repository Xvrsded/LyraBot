class InstallProgressPage {
    render(state) {
        let bar = '';
        const filled = Math.floor(state.progress / 10);
        for(let i=0; i<10; i++) bar += (i < filled) ? '█' : '░';

        let content = `**Installing...**\n[${bar}] ${state.progress}%\n`;
        if (state.status === 'completed') content += '\n✅ Installation Complete!';
        else if (state.status === 'failed') content += '\n❌ Installation Failed!';
        else content += '\n⏳ Please wait while resources are provisioned...';

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const row = new ActionRowBuilder();

        if (state.status === 'failed' || state.status === 'running' || !state.status) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('ui:setup:action:cancel_install')
                    .setLabel('Cancel & Rollback')
                    .setStyle(ButtonStyle.Danger)
            );
        }
        if (state.status === 'completed') {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('ui:setup:close')
                    .setLabel('Finish')
                    .setStyle(ButtonStyle.Success)
            );
        }

        return { content, components: [row] };
    }
}
module.exports = new InstallProgressPage();
