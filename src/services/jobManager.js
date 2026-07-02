const ScheduledJob = require('../models/ScheduledJob');
const logger = require('../utils/logger');

class JobManager {
    constructor() {
        this.handlers = new Map(); // jobName -> handlerFn
    }

    /**
     * Registers a callback handler function for a specific job name.
     * @param {string} name Unique name of the job
     * @param {function} handlerFn Callback function (receives jobContext)
     * @returns {void}
     */
    registerJob(name, handlerFn) {
        this.handlers.set(name, handlerFn);
        logger.info(`[JobManager] Registered handler for job: "${name}"`);
    }

    /**
     * Unregisters a callback handler (useful during plugin reloads).
     * @param {string} name Unique name of the job
     * @returns {void}
     */
    unregisterJob(name) {
        if (this.handlers.delete(name)) {
            logger.info(`[JobManager] Unregistered handler for job: "${name}"`);
        }
    }

    /**
     * Schedules a persistent Cron job.
     * @param {string} name Unique name of the job
     * @param {string} cronExpression Standard cron syntax (e.g. cron string)
     * @param {object} data Optional payload payload data
     * @param {object} options Optional configs (maxRetries, retryDelay)
     * @returns {Promise<Document>} The Mongoose Job document
     */
    async scheduleCron(name, cronExpression, data = {}, options = {}) {
        const { maxRetries = 3, retryDelay = 5000 } = options;

        const job = await ScheduledJob.findOneAndUpdate(
            { name },
            {
                type: 'cron',
                pattern: cronExpression,
                data,
                status: 'active',
                maxRetries,
                retryDelay,
                nextRunAt: null // Managed by cron scheduler
            },
            { upsert: true, new: true }
        );

        // Notify scheduler to register or update in-memory cron runner
        const scheduler = require('./scheduler');
        scheduler.registerCronRunner(job);

        return job;
    }

    /**
     * Schedules a recurring Interval job.
     * @param {string} name Unique name of the job
     * @param {number} intervalMs Execution loop gap in milliseconds
     * @param {object} data Optional payload data
     * @param {object} options Optional configs (maxRetries, retryDelay)
     * @returns {Promise<Document>} The Mongoose Job document
     */
    async scheduleInterval(name, intervalMs, data = {}, options = {}) {
        const { maxRetries = 3, retryDelay = 5000 } = options;
        const nextRunAt = new Date(Date.now() + intervalMs);

        const job = await ScheduledJob.findOneAndUpdate(
            { name },
            {
                type: 'interval',
                pattern: String(intervalMs),
                data,
                status: 'active',
                maxRetries,
                retryDelay,
                nextRunAt
            },
            { upsert: true, new: true }
        );

        logger.info(`[JobManager] Scheduled interval job: "${name}" running every ${intervalMs}ms`);
        return job;
    }

    /**
     * Schedules a delayed, one-time job.
     * @param {string} name Unique name of the job
     * @param {number} delayMs Delay duration in milliseconds before running
     * @param {object} data Optional payload data
     * @param {object} options Optional configs (maxRetries, retryDelay)
     * @returns {Promise<Document>} The Mongoose Job document
     */
    async scheduleDelayed(name, delayMs, data = {}, options = {}) {
        const { maxRetries = 3, retryDelay = 5000 } = options;
        const nextRunAt = new Date(Date.now() + delayMs);

        const job = await ScheduledJob.findOneAndUpdate(
            { name },
            {
                type: 'delayed',
                pattern: null,
                data,
                status: 'active',
                maxRetries,
                retryDelay,
                nextRunAt
            },
            { upsert: true, new: true }
        );

        logger.info(`[JobManager] Scheduled delayed job: "${name}" in ${delayMs}ms`);
        return job;
    }

    /**
     * Pauses an active job.
     * @param {string} name Unique name of the job
     * @returns {Promise<boolean>} Success status
     */
    async pauseJob(name) {
        const job = await ScheduledJob.findOne({ name });
        if (!job) return false;

        job.status = 'paused';
        await job.save();

        const scheduler = require('./scheduler');
        scheduler.pauseCronRunner(name);

        logger.info(`[JobManager] Paused job: "${name}"`);
        return true;
    }

    /**
     * Resumes a paused job.
     * @param {string} name Unique name of the job
     * @returns {Promise<boolean>} Success status
     */
    async resumeJob(name) {
        const job = await ScheduledJob.findOne({ name });
        if (!job) return false;

        job.status = 'active';
        
        // Reset next run time if it was delayed or interval
        if (job.type === 'interval') {
            job.nextRunAt = new Date(Date.now() + Number(job.pattern));
        } else if (job.type === 'delayed') {
            job.nextRunAt = new Date(Date.now() + 5000); // Trigger in 5s
        }

        await job.save();

        const scheduler = require('./scheduler');
        scheduler.resumeCronRunner(job);

        logger.info(`[JobManager] Resumed job: "${name}"`);
        return true;
    }

    /**
     * Cancels/deletes a job from database and registry.
     * @param {string} name Unique name of the job
     * @returns {Promise<boolean>} Success status
     */
    async cancelJob(name) {
        const result = await ScheduledJob.deleteOne({ name });
        if (result.deletedCount === 0) return false;

        const scheduler = require('./scheduler');
        scheduler.destroyCronRunner(name);

        logger.info(`[JobManager] Cancelled and deleted job: "${name}"`);
        return true;
    }
}

module.exports = new JobManager();
