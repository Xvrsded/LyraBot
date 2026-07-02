const os = require('os');
const logger = require('../utils/logger');

class MetricsService {
    constructor() {
        this.commandsCount = new Map();     // cmdName -> count
        this.commandsLatency = new Map();   // cmdName -> Array of latencies
        this.pluginErrors = new Map();       // pluginName -> Array of errors
        this.eventEmissions = new Map();     // eventName -> count
        
        this.mongoQueriesCount = 0;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        
        // Initial process start CPU tracking
        this.startCpuUsage = process.cpuUsage();
        this.startTime = Date.now();
    }

    /**
     * Increments query count from Mongoose instrumentation hook.
     */
    recordMongoQuery() {
        this.mongoQueriesCount++;
    }

    /**
     * Increments cache hit count.
     */
    recordCacheHit() {
        this.cacheHits++;
    }

    /**
     * Increments cache miss count.
     */
    recordCacheMiss() {
        this.cacheMisses++;
    }

    /**
     * Records a command execution and its duration.
     * @param {string} cmdName Command name
     * @param {number} latencyMs Execution duration in milliseconds
     */
    recordCommand(cmdName, latencyMs) {
        const count = this.commandsCount.get(cmdName) || 0;
        this.commandsCount.set(cmdName, count + 1);

        const latencies = this.commandsLatency.get(cmdName) || [];
        latencies.push(latencyMs);
        if (latencies.length > 100) latencies.shift(); // Keep last 100
        this.commandsLatency.set(cmdName, latencies);
    }

    /**
     * Records a plugin execution error.
     * @param {string} pluginName 
     * @param {string} errorMsg 
     */
    recordPluginError(pluginName, errorMsg) {
        const errors = this.pluginErrors.get(pluginName) || [];
        errors.push({ timestamp: new Date(), message: errorMsg });
        if (errors.length > 50) errors.shift(); // Keep last 50
        this.pluginErrors.set(pluginName, errors);
    }

    /**
     * Records event emissions.
     * @param {string} eventName 
     */
    recordEvent(eventName) {
        const count = this.eventEmissions.get(eventName) || 0;
        this.eventEmissions.set(eventName, count + 1);
    }

    /**
     * Calculates the average latency for a command.
     * @param {string} cmdName Command name
     * @returns {number} Average latency in ms
     */
    getAverageLatency(cmdName) {
        const latencies = this.commandsLatency.get(cmdName) || [];
        if (latencies.length === 0) return 0;
        const sum = latencies.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / latencies.length);
    }

    /**
     * Calculates current CPU usage percentage of the Node process.
     * @returns {number} CPU usage percentage (e.g. 1.25)
     */
    getCPUUsage() {
        const elapCpu = process.cpuUsage(this.startCpuUsage);
        const elapTime = Date.now() - this.startTime;
        
        // Convert to microseconds
        const elapTimeMS = elapTime * 1000;
        const totalCpuTime = elapCpu.user + elapCpu.system;
        
        // Divide by number of cores to represent system percentage
        const numCores = os.cpus().length;
        const percent = (totalCpuTime / elapTimeMS) * 100 / numCores;
        
        return Math.min(100, Math.round(percent * 100) / 100);
    }

    /**
     * Compiles a snapshot of all system and bot performance metrics.
     * @param {Client} client Discord Client object
     * @returns {object} Telemetry report snapshot
     */
    getTelemetryReport(client) {
        const memory = process.memoryUsage();
        const scheduler = require('./scheduler');

        const activeJobsCount = scheduler.cronTasks ? scheduler.cronTasks.size : 0;
        const totalScheduledJobs = scheduler.metrics ? scheduler.metrics.totalRuns : 0;

        // Command stats compiler
        const commandStats = [];
        for (const [name, count] of this.commandsCount.entries()) {
            commandStats.push({
                name,
                invocations: count,
                avgLatencyMs: this.getAverageLatency(name)
            });
        }

        // Plugin error compiler
        const pluginErrorStats = [];
        for (const [name, errors] of this.pluginErrors.entries()) {
            pluginErrorStats.push({
                pluginName: name,
                totalErrors: errors.length,
                lastError: errors[errors.length - 1]
            });
        }

        // Event stats compiler
        const eventStats = [];
        for (const [name, count] of this.eventEmissions.entries()) {
            eventStats.push({ name, count });
        }

        return {
            system: {
                uptimeSeconds: Math.round(process.uptime()),
                memoryUsageMB: {
                    rss: Math.round(memory.rss / 1024 / 1024),
                    heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
                },
                cpuPercent: this.getCPUUsage(),
                gatewayPingMs: client ? client.ws.ping : -1
            },
            database: {
                mongooseQueries: this.mongoQueriesCount
            },
            cache: {
                hits: this.cacheHits,
                misses: this.cacheMisses,
                hitRatioPercent: (this.cacheHits + this.cacheMisses) > 0 
                    ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100) 
                    : 0
            },
            scheduler: {
                activeCronTasks: activeJobsCount,
                totalRuns: totalScheduledJobs,
                successfulRuns: scheduler.metrics ? scheduler.metrics.successfulRuns : 0,
                failedRuns: scheduler.metrics ? scheduler.metrics.failedRuns : 0
            },
            commands: commandStats,
            events: eventStats,
            pluginErrors: pluginErrorStats,
            timestamp: new Date()
        };
    }

    /**
     * Exports a compiled snapshot report formatted as raw JSON text.
     * @param {Client} client Discord Client object
     * @returns {string} Stringified JSON text
     */
    exportJSON(client) {
        return JSON.stringify(this.getTelemetryReport(client), null, 4);
    }
}

module.exports = new MetricsService();
