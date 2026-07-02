const workflowRegistry = require('./workflowRegistry');

class WorkflowValidator {
    /**
     * Validates if a workflow activity exists in the registry.
     */
    validateActivity(activity) {
        const modules = workflowRegistry.getModulesForActivity(activity);
        if (!modules || modules.length === 0) {
            return false;
        }
        return true;
    }

    /**
     * Checks if a module is registered in dependencies or priorities.
     */
    validateModule(moduleName) {
        return typeof workflowRegistry.priorities[moduleName] !== 'undefined';
    }
}

module.exports = new WorkflowValidator();
