const configBreadcrumbs = require('../components/configBreadcrumbs');
const owoConfigManager = require('../services/owoConfigManager');

class ParserConfigPage {
    async render(guildId) {
        const breadcrumb = configBreadcrumbs.render(['Parsers']);
        const getVal = async (key) => (await owoConfigManager.getConfig(guildId, `parser.${key}`)) !== false;

        const components = [
            { type: 'toggle', label: 'Hunt Parsing', value: await getVal('hunt'), id: 'owo_cfg_parser_hunt' },
            { type: 'toggle', label: 'Battle Parsing', value: await getVal('battle'), id: 'owo_cfg_parser_battle' },
            { type: 'toggle', label: 'Quest Parsing', value: await getVal('quest'), id: 'owo_cfg_parser_quest' },
            { type: 'toggle', label: 'Zoo Parsing', value: await getVal('zoo'), id: 'owo_cfg_parser_zoo' },
            { type: 'toggle', label: 'Inventory Parsing', value: await getVal('inventory'), id: 'owo_cfg_parser_inventory' },
            { type: 'toggle', label: 'Cooldown Detection', value: await getVal('cooldown'), id: 'owo_cfg_parser_cooldown' },
            { type: 'button', label: 'Back to Overview', id: 'owo_cfg_overview', style: 'secondary' }
        ];

        return {
            content: `${breadcrumb}**Parser Configuration**\nEnable or disable specific OwO message parsing capabilities. Disable parsers you don't use to save CPU.`,
            components
        };
    }
}
module.exports = new ParserConfigPage();
