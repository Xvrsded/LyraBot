const workflowRegistry = require('./workflowRegistry');

class DependencyResolver {
    /**
     * Resolves the order of modules to execute using Topological Sort.
     * Also prunes dependencies that are not in the target modules list.
     * @param {string[]} targetModules Modules required for this activity
     * @returns {string[]} Ordered list of modules
     * @throws {Error} If cyclic dependency detected
     */
    resolve(targetModules) {
        if (!targetModules || targetModules.length === 0) return [];

        const graph = new Map();
        const inDegree = new Map();

        // Initialize maps
        for (const mod of targetModules) {
            graph.set(mod, []);
            inDegree.set(mod, 0);
        }

        // Build the graph
        for (const mod of targetModules) {
            const deps = workflowRegistry.getDependencies(mod);
            for (const dep of deps) {
                // Only consider dependencies that are actually part of this workflow run
                if (targetModules.includes(dep)) {
                    graph.get(dep).push(mod);
                    inDegree.set(mod, inDegree.get(mod) + 1);
                }
            }
        }

        // Topological Sort via Kahn's Algorithm
        const queue = [];
        for (const [mod, degree] of inDegree.entries()) {
            if (degree === 0) queue.push(mod);
        }

        const resolved = [];
        while (queue.length > 0) {
            const current = queue.shift();
            resolved.push(current);

            for (const neighbor of graph.get(current)) {
                inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                if (inDegree.get(neighbor) === 0) {
                    queue.push(neighbor);
                }
            }
        }

        if (resolved.length !== targetModules.length) {
            throw new Error('Cyclic dependency detected in workflow modules');
        }

        return resolved;
    }
}

module.exports = new DependencyResolver();
