const cron = require('node-cron');
const ScheduledJob = require('../models/ScheduledJob');
const JobHistory = require('../models/JobHistory');
const jobManager = require('./jobManager');
const logger = require('../utils/logger');

class Scheduler {
    constructor() {
        this.client = null;
        this.cronTasks = new Map();     // jobName -> cronTask
        this.pollingInterval = null;
        this.isRunningPolling = false;

        // In-memory runtime metrics tracking
        this.metrics = {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            totalExecutionTimeMs: 0
        };
    }

    /**
     * Initializes the scheduler. Restores persistent jobs, registers cron jobs, and starts the polling loop.
     * @param {Client} client Discord Client instance
     * @returns {Promise<void>}
     */
    async init(client) {
        this.client = client;
        logger.info('[Scheduler] Initializing Data & Scheduler Framework...');

        // 1. Restore persistent Cron jobs from MongoDB
        try {
            const activeCronJobs = await ScheduledJob.find({ type: 'cron', status: 'active' });
            for (const job of activeCronJobs) {
                this.registerCronRunner(job);
            }
            logger.info(`[Scheduler] Restored ${activeCronJobs.length} active cron jobs in memory.`);
        } catch (err) {
            logger.error('[Scheduler] Failed to restore cron jobs from DB:', err.message);
        }

        // 2. Start the lightweight 5-second database polling loop for interval/delayed jobs
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => this.pollJobs(), 5000);
        logger.info('[Scheduler] Background job polling loop active (every 5 seconds).');
    }

    /**
     * Polling database search for active interval and delayed jobs whose next execution time has passed.
     * @private
     * @returns {Promise<void>}
     */
    async pollJobs() {
        if (this.isRunningPolling) return;
        this.isRunningPolling = true;

        try {
            const now = new Date();
            // Fetch jobs that are active, not cron type, and scheduled to run now or in the past
            const pendingJobs = await ScheduledJob.find({
                status: 'active',
                type: { $ne: 'cron' },
                nextRunAt: { $lte: now }
            });

            for (const job of pendingJobs) {
                await this.executeJob(job);
            }
        } catch (err) {
            logger.error('[Scheduler] Error during job polling:', err.message);
        } finally {
            this.isRunningPolling = false;
        }
    }

    /**
     * Registers and spins up a cron job in node-cron memory.
     * @param {Document} job Mongoose ScheduledJob document
     * @returns {void}
     */
    registerCronRunner(job) {
        this.destroyCronRunner(job.name);

        if (job.status !== 'active') return;

        try {
            const cronTask = cron.schedule(job.pattern, async () => {
                // Fetch latest state from database before running
                const freshJob = await ScheduledJob.findById(job._id);
                if (freshJob && freshJob.status === 'active') {
                    await this.executeJob(freshJob);
                }
            });
            
            this.cronTasks.set(job.name, cronTask);
            logger.info(`[Scheduler] Cron runner started for job: "${job.name}" [${job.pattern}]`);
        } catch (err) {
            logger.error(`[Scheduler] Failed to register cron pattern for job "${job.name}":`, err.message);
        }
    }

    /**
     * Pauses a cron runner in memory.
     * @param {string} name Unique name of the job
     * @returns {void}
     */
    pauseCronRunner(name) {
        const task = this.cronTasks.get(name);
        if (task) {
            task.stop();
            logger.info(`[Scheduler] Stopped memory cron runner for job: "${name}"`);
        }
    }

    /**
     * Resumes a cron runner in memory.
     * @param {Document} job Mongoose ScheduledJob document
     * @returns {void}
     */
    resumeCronRunner(job) {
        if (job.type === 'cron') {
            this.registerCronRunner(job);
        }
    }

    /**
     * Stops and deletes a cron runner from memory.
     * @param {string} name Unique name of the job
     * @returns {void}
     */
    destroyCronRunner(name) {
        const task = this.cronTasks.get(name);
        if (task) {
            task.stop();
            this.cronTasks.delete(name);
            logger.info(`[Scheduler] Destroyed memory cron runner for job: "${name}"`);
        }
    }

    /**
     * Executes a scheduled job, managing history logs, error retries, and DLQ handling.
     * @param {Document} job Mongoose ScheduledJob document
     * @returns {Promise<void>}
     */
    async executeJob(job) {
        const handler = jobManager.handlers.get(job.name);
        const startedAt = new Date();
        
        if (!handler) {
            logger.warn(`[Scheduler] Skip job "${job.name}": Handler tidak ditemukan (Mungkin plugin dinonaktifkan).`);
            // Postpone interval jobs to prevent infinite polling log spam
            if (job.type === 'interval') {
                job.nextRunAt = new Date(Date.now() + Number(job.pattern));
                await job.save();
            }
            return;
        }

        logger.info(`[Scheduler] Running job task: "${job.name}"...`);
        this.metrics.totalRuns++;

        try {
            const jobContext = {
                name: job.name,
                data: job.data,
                client: this.client
            };

            // Execute the plugin job callback
            await handler(jobContext);

            const completedAt = new Date();
            const durationMs = completedAt - startedAt;

            // 1. Log History
            await JobHistory.create({
                jobId: job._id,
                jobName: job.name,
                status: 'success',
                startedAt,
                completedAt,
                durationMs,
                retryAttempt: job.retryCount
            });

            // 2. Update runtime stats
            this.metrics.successfulRuns++;
            this.metrics.totalExecutionTimeMs += durationMs;

            // 3. Reset retry counts & reschedule
            job.retryCount = 0;
            job.lastRunAt = completedAt;
            
            if (job.type === 'interval') {
                job.nextRunAt = new Date(Date.now() + Number(job.pattern));
            } else if (job.type === 'delayed' || job.type === 'once') {
                job.status = 'completed';
                job.nextRunAt = null;
            }

            await job.save();
            logger.info(`[Scheduler] Job task "${job.name}" completed successfully in ${durationMs}ms.`);
        } catch (err) {
            const completedAt = new Date();
            const durationMs = completedAt - startedAt;
            
            logger.error(`[Scheduler] Job task "${job.name}" failed:`, err.message);
            this.metrics.failedRuns++;
            this.metrics.totalExecutionTimeMs += durationMs;

            // 1. Log error history
            await JobHistory.create({
                jobId: job._id,
                jobName: job.name,
                status: 'failed',
                startedAt,
                completedAt,
                durationMs,
                error: err.message,
                retryAttempt: job.retryCount
            });

            // 2. Implement Retry Policy & DLQ
            job.retryCount++;
            
            if (job.retryCount <= job.maxRetries) {
                const nextRetry = new Date(Date.now() + job.retryDelay);
                job.nextRunAt = nextRetry;
                logger.warn(`[Scheduler] Retrying job "${job.name}" (Percobaan ${job.retryCount}/${job.maxRetries}) in ${job.retryDelay}ms.`);
                await job.save();
            } else {
                // Maximum retries exceeded -> Dead Letter Queue (DLQ)
                job.status = 'failed';
                job.nextRunAt = null;
                logger.error(`[DEAD LETTER QUEUE] Job "${job.name}" gagal permanen setelah ${job.maxRetries} percobaan. Mematikan jadwal.`);
                await job.save();
            }
        }
    }
}

module.exports = new Scheduler();
