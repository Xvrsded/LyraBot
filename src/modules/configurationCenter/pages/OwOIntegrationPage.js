class OwOIntegrationPage {
    render(context, state) {
        return {
            content: '**OwO Integration Settings**',
            components: [
                { type: 'toggle', label: 'Enable Hunt Detection', value: state.owoIntegration?.huntEnabled || false }
            ]
        };
    }
}
module.exports = new OwOIntegrationPage();
