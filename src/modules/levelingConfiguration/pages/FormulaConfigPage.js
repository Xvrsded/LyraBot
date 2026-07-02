const owoConfigBreadcrumbs = require('../../owoConfiguration/components/configBreadcrumbs');
const levelingConfigManager = require('../services/levelingConfigManager');

class FormulaConfigPage {
    async render(guildId) {
        const breadcrumb = owoConfigBreadcrumbs.render(['Leveling Overview', 'Formula Configuration']);
        const type = await levelingConfigManager.getConfig(guildId, 'formula.type') || 'Linear';
        const customFormula = await levelingConfigManager.getConfig(guildId, 'formula.custom') || '(level * 100)';

        const components = [
            { type: 'select', id: 'lvl_cfg_formula_type', placeholder: 'Select Formula Type...', options: [
                { label: 'Linear', value: 'linear', default: type === 'Linear' },
                { label: 'Quadratic', value: 'quadratic', default: type === 'Quadratic' },
                { label: 'Exponential', value: 'exponential', default: type === 'Exponential' },
                { label: 'Custom Formula', value: 'custom', default: type === 'Custom' }
            ]},
            { type: 'button', label: 'Edit Custom Formula', id: 'lvl_cfg_formula_edit', style: 'primary', disabled: type !== 'Custom' },
            { type: 'button', label: 'Back', id: 'lvl_cfg_overview', style: 'secondary' }
        ];

        let content = `${breadcrumb}**Formula Configuration**\n\n`;
        content += `**Current Type:** ${type}\n`;
        if (type === 'Custom') {
            content += `**Custom Formula:** \`${customFormula}\`\n\n`;
            content += `*Note: Custom formulas use a safe parser. Only numbers, level, and (+, -, *, /, ^, ()) are allowed.*`;
        }

        return { content, components };
    }
}
module.exports = new FormulaConfigPage();
