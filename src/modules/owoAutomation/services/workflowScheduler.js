const workflowRegistry = require('./workflowRegistry');

class WorkflowScheduler {
    /**
     * Groups modules into execution waves based on priorities and resolved dependencies.
     * Higher priority modules that have no unresolved dependencies execute first.
     * But since topological sort already guarantees dependency safety, we can just sort
     * within independent layers or just execute in topological order but prioritizing
     * critical modules if they can run.
     * 
     * To keep it simple but compliant: The topological sort already ensures dependency order.
     * If two modules have the same dependency depth, we sort by priority.
     */
    schedule(resolvedModules) {
        if (!resolvedModules || resolvedModules.length === 0) return [];
        
        // Return a queue sorted strictly by their topological position, 
        // and for ties (independent modules), sorted by Priority.
        // Actually, Kahn's algorithm output can just be bubble-sorted 
        // to float high priority items up AS LONG AS it doesn't violate dependencies.
        // A simpler way: we just return the resolved list, but let the Executor know priorities.
        // But the prompt wants a Priority Queue. Let's group them into waves (layers).

        const waves = [];
        let currentWave = [];
        let completed = new Set();
        
        let remaining = [...resolvedModules];
        
        while (remaining.length > 0) {
            currentWave = [];
            
            // Find all modules whose dependencies are satisfied in `completed`
            for (const mod of remaining) {
                const deps = workflowRegistry.getDependencies(mod).filter(d => resolvedModules.includes(d));
                const canRun = deps.every(d => completed.has(d));
                if (canRun) {
                    currentWave.push(mod);
                }
            }

            // Sort current wave by priority descending
            currentWave.sort((a, b) => workflowRegistry.getPriority(b) - workflowRegistry.getPriority(a));

            waves.push(currentWave);
            
            // Mark as completed
            for (const mod of currentWave) {
                completed.add(mod);
            }
            
            // Remove from remaining
            remaining = remaining.filter(m => !currentWave.includes(m));
        }

        return waves;
    }
}

module.exports = new WorkflowScheduler();
