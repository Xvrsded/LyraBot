class SetupProgress {
    /**
     * Generates a stylized live progress string with a progress bar.
     * @param {number} completed Count of completed actions
     * @param {number} total Total actions planned
     * @param {string} currentActionName The name of the action currently executing
     * @returns {string} Stylized text description
     */
    getProgressString(completed, total, currentActionName) {
        if (total === 0) return '`🟢 Selesai`';
        const percent = Math.min(100, Math.round((completed / total) * 100));
        
        // Progress bar width of 15 characters
        const barWidth = 15;
        const filledWidth = Math.round((completed / total) * barWidth);
        const emptyWidth = barWidth - filledWidth;
        
        const filled = '█'.repeat(filledWidth);
        const empty = '░'.repeat(emptyWidth);
        
        return `\`[${filled}${empty}]\` **${percent}%**\n` +
               `• Status: *${completed}/${total} Aksi Selesai*\n` +
               `• Sedang diproses: \`${currentActionName}\``;
    }
}

module.exports = new SetupProgress();
