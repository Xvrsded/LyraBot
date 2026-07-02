const SetupWizardState = require('../models/SetupWizardState');

class PersistenceService {
    async getState(guildId) {
        let state = null;
        try {
            state = await SetupWizardState.findOne({ guildId });
        } catch (e) {}

        if (!state) {
            state = new SetupWizardState({ guildId });
            try { await state.save(); } catch(e){}
        }
        return state;
    }

    async saveState(state) {
        state.updatedAt = Date.now();
        try { await state.save(); } catch(e){}
        return state;
    }

    async resetState(guildId) {
        try {
            await SetupWizardState.deleteOne({ guildId });
        } catch (e) {}
    }
}

module.exports = new PersistenceService();
