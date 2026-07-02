const workflows = require('../registry/workflows.json');
const priorities = require('../registry/priorities.json');
const dependencies = require('../registry/dependencies.json');

class WorkflowRegistry {
    constructor() {
        this.workflows = workflows;
        this.priorities = priorities;
        this.dependencies = dependencies;
    }

    getModulesForActivity(activity) {
        return this.workflows[activity] || [];
    }

    getPriority(moduleName) {
        return this.priorities[moduleName] || 0;
    }

    getDependencies(moduleName) {
        return this.dependencies[moduleName] || [];
    }
    
    // For Plugin API to register workflows dynamically
    registerActivityWorkflow(activity, moduleList) {
        this.workflows[activity] = moduleList;
    }
}

module.exports = new WorkflowRegistry();
