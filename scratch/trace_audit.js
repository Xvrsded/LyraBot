const Module = require('module');
const path = require('path');
const fs = require('fs');

const originalRequire = Module.prototype.require;
const loadedModules = new Set();
const importGraph = {};

Module.prototype.require = function(id) {
    const caller = this.filename;
    let resolved;
    try {
        resolved = Module._resolveFilename(id, this);
    } catch (e) {
        return originalRequire.apply(this, arguments);
    }

    if (resolved.includes('BotDiscord\\src\\') || resolved.includes('BotDiscord/src/')) {
        const normalizedResolved = resolved.replace(/\\/g, '/').split('/src/')[1];
        let normalizedCaller = caller.replace(/\\/g, '/');
        if (normalizedCaller.includes('/src/')) {
            normalizedCaller = normalizedCaller.split('/src/')[1];
        } else {
            normalizedCaller = 'ROOT';
        }

        loadedModules.add(normalizedResolved);
        if (!importGraph[normalizedResolved]) {
            importGraph[normalizedResolved] = new Set();
        }
        importGraph[normalizedResolved].add(normalizedCaller);
    }

    return originalRequire.apply(this, arguments);
};

// Start E2E runner logic
require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const { loadEvents } = require('../src/handlers/eventHandler');
const { loadCommands } = require('../src/handlers/commandHandler');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

async function trace() {
    console.log('Tracing runtime dependencies...');
    await mongoose.connect(process.env.MONGO_URI);
    
    // We don't login to discord to save time, we just load handlers.
    // loadEvents and loadCommands recursively require everything used.
    // Then we trigger fake bot.ready
    
    loadEvents(client);
    loadCommands(client);
    
    // Simulate runtime wiring dynamically
    const eventBus = require('../src/services/eventBus');
    eventBus.emit('bot.ready');
    eventBus.emit('setup.completed');
    eventBus.emit('configuration.updated', { guildId: '123', key: 'owo', value: '1' });
    
    await new Promise(r => setTimeout(r, 3000)); // wait for async plugin loads
    
    console.log('--- TRACE COMPLETE ---');
    
    // Now analyze
    function walk(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                walk(filePath, fileList);
            } else if (filePath.endsWith('.js')) {
                fileList.push(filePath.replace(/\\/g, '/').split('/src/')[1]);
            }
        }
        return fileList;
    }

    const allFiles = walk(path.join(__dirname, '../src'));
    const archiveFiles = allFiles.filter(f => f && (f.startsWith('archive/') || f.startsWith('backup/')));
    const nonArchiveFiles = allFiles.filter(f => f && !archiveFiles.includes(f));
    
    let stats = {
        productionIssues: { critical: [], major: [], minor: [] },
        deadCode: [],
        archive: archiveFiles,
        legacy: [],
        unused: [],
        techDebt: []
    };

    nonArchiveFiles.forEach(file => {
        if (!loadedModules.has(file)) {
            if (file.includes('test') || file.includes('mock')) {
                stats.unused.push(file);
            } else if (file.includes('legacy') || file.includes('old')) {
                stats.legacy.push(file);
            } else {
                stats.deadCode.push(file);
            }
        } else {
            // File is loaded in production! Let's check for issues.
            const fullPath = path.join(__dirname, '../src', file);
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            
            // Check issues
            if (content.includes('TODO') || content.includes('FIXME') || content.includes('console.log')) {
                stats.techDebt.push(file);
                // Also add to minor
                stats.productionIssues.minor.push({
                    file, function: 'N/A', rootCause: 'Contains TODO/console.log', impact: 'Maintainability', fix: 'Remove logs and comments'
                });
            }
            if (content.includes('Fallback renderer')) {
                stats.productionIssues.major.push({
                    file, function: 'render()', rootCause: 'Fallback renderer active', impact: 'UI not accurate', fix: 'Implement proper UI'
                });
            }
            if (content.match(/catch\\s*\\([^)]*\\)\\s*\\{[^}]*\\}/g)) {
                if (!content.includes('audit.error') && !content.includes('logger.error') && !content.includes('AuditService')) {
                    stats.productionIssues.critical.push({
                        file, function: 'Various (try/catch)', rootCause: 'Silent error catch', impact: 'Errors hidden from control center', fix: 'Inject AuditService'
                    });
                }
            }
            if (content.includes('Mock') && !file.includes('test')) {
                stats.productionIssues.critical.push({
                    file, function: 'Mocking', rootCause: 'Mock object in production', impact: 'Fake data returned', fix: 'Implement real DB logic'
                });
            }
        }
    });

    const output = {
        ProductionRuntimeIssues: {
            Critical: stats.productionIssues.critical.length,
            Major: stats.productionIssues.major.length,
            Minor: stats.productionIssues.minor.length,
            Details: stats.productionIssues.critical
        },
        DeadCode: stats.deadCode.length,
        Archive: stats.archive.length,
        Legacy: stats.legacy.length,
        Unused: stats.unused.length,
        TechDebt: stats.techDebt.length
    };
    
    fs.writeFileSync(path.join(__dirname, 'trace_results.json'), JSON.stringify(output, null, 2));
    console.log('--- ANALYSIS SAVED TO trace_results.json ---');
    
    process.exit(0);
}

trace().catch(console.error);
