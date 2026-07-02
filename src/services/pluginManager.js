const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const PluginContext = require('./pluginContext');
const logger = require('../utils/logger');

class PluginManager extends EventEmitter {
    constructor() {
        super();
        this.pluginsPath = path.join(__dirname, '../plugins');
        this.client = null;
        this.context = null;

        // Registries
        this.plugins = new Map();          // name -> pluginInstance
        this.rawRegistry = new Map();      // name -> plugin.json metadata
        this.activeStatus = new Map();     // name -> 'loaded'|'enabled'|'disabled'
        
        // Resource trackers for clean unloads
        this.loadedCommands = new Map();   // name -> Array of command names
        this.loadedEvents = new Map();     // name -> Array of { name, listener }
    }

    /**
     * Initialize the plugin framework. Discover, sort dependencies, and load all plugins.
     * @param {Client} client Discord Client instance
     * @returns {Promise<void>}
     */
    async init(client) {
        this.client = client;
        this.context = new PluginContext(client, this);

        logger.info('[PluginManager] Starting plugin discovery...');
        if (!fs.existsSync(this.pluginsPath)) {
            logger.warn(`[PluginManager] Folder plugins tidak ditemukan di: ${this.pluginsPath}. Membuat folder...`);
            fs.mkdirSync(this.pluginsPath, { recursive: true });
            return;
        }

        // 1. Discover all plugins and load metadata
        const dirs = fs.readdirSync(this.pluginsPath).filter(d => {
            return fs.statSync(path.join(this.pluginsPath, d)).isDirectory();
        });

        for (const dir of dirs) {
            const pluginDir = path.join(this.pluginsPath, dir);
            const metaPath = path.join(pluginDir, 'plugin.json');
            
            if (!fs.existsSync(metaPath)) {
                logger.warn(`[PluginManager] Skip folder "${dir}" karena tidak memiliki file plugin.json.`);
                continue;
            }

            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                const pluginName = meta.name || dir;
                this.rawRegistry.set(pluginName, { ...meta, dirName: dir });
                logger.debug(`[PluginManager] Discovered plugin "${pluginName}"`);
            } catch (err) {
                logger.error(`[PluginManager] Gagal membaca metadata di "${dir}":`, err.message);
            }
        }

        // 2. Resolve loading order (Topological Sort based on dependencies)
        let loadOrder = [];
        try {
            loadOrder = this.resolveLoadOrder();
        } catch (err) {
            logger.error(`[PluginManager] Dependency resolution failed:`, err.message);
            return;
        }

        // 3. Load and Enable each plugin in order
        for (const name of loadOrder) {
            try {
                await this.load(name);
                await this.enable(name);
            } catch (err) {
                logger.error(`[PluginManager] Gagal memuat/mengaktifkan plugin "${name}":`, err.message);
            }
        }

        logger.info(`[PluginManager] Initialized successfully. ${this.plugins.size} plugins active.`);
    }

    /**
     * Resolves plugin loading order based on dependencies.
     * @private
     * @returns {string[]} Ordered list of plugin names
     */
    resolveLoadOrder() {
        const sorted = [];
        const visited = new Map(); // name -> boolean (false: visiting, true: visited)

        const visit = (name) => {
            if (visited.get(name) === false) {
                throw new Error(`Circular dependency detected: Lingkaran ketergantungan melibatkan plugin "${name}".`);
            }
            if (visited.has(name)) return;

            visited.set(name, false); // Mark as visiting

            const meta = this.rawRegistry.get(name);
            if (meta && meta.dependencies) {
                for (const dep of meta.dependencies) {
                    if (!this.rawRegistry.has(dep)) {
                        throw new Error(`Missing dependency: Plugin "${name}" membutuhkan "${dep}" yang tidak ada.`);
                    }
                    visit(dep);
                }
            }

            visited.set(name, true); // Mark as visited
            sorted.push(name);
        };

        for (const name of this.rawRegistry.keys()) {
            visit(name);
        }

        return sorted;
    }

    /**
     * Load a plugin by its registered name.
     * @param {string} name Plugin name
     * @returns {Promise<void>}
     */
    async load(name) {
        if (this.plugins.has(name)) {
            logger.warn(`[PluginManager] Plugin "${name}" sudah ter-load.`);
            return;
        }

        const meta = this.rawRegistry.get(name);
        if (!meta) {
            throw new Error(`Plugin "${name}" tidak ditemukan di registri metadata.`);
        }

        const pluginDir = path.join(this.pluginsPath, meta.dirName);
        const entryPath = path.join(pluginDir, 'index.js');

        if (!fs.existsSync(entryPath)) {
            throw new Error(`Entry point file "index.js" tidak ditemukan pada plugin "${name}".`);
        }

        logger.info(`[PluginManager] Loading plugin: "${name}" v${meta.version || '1.0.0'}`);

        // Require entry point (instantiate class)
        const PluginClass = require(entryPath);
        const pluginInstance = new (PluginClass.default || PluginClass)();

        // 1. Execute onLoad Lifecycle
        if (typeof pluginInstance.onLoad === 'function') {
            await pluginInstance.onLoad(this.context);
        }

        // 2. Load Commands dynamically
        const commandsDir = path.join(pluginDir, 'commands');
        const commandNames = [];
        if (fs.existsSync(commandsDir)) {
            const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
            for (const file of files) {
                const command = require(path.join(commandsDir, file));
                if (command.data && command.execute) {
                    this.client.commands.set(command.data.name, command);
                    commandNames.push(command.data.name);
                    logger.debug(`[PluginManager] Registered command: "/${command.data.name}" from plugin "${name}"`);
                }
            }
        }
        this.loadedCommands.set(name, commandNames);

        // 3. Load Events dynamically
        const eventsDir = path.join(pluginDir, 'events');
        const eventListeners = [];
        if (fs.existsSync(eventsDir)) {
            const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));
            for (const file of files) {
                const event = require(path.join(eventsDir, file));
                if (event.name && event.execute) {
                    const listener = (...args) => event.execute(...args, this.client);
                    if (event.once) {
                        this.client.once(event.name, listener);
                    } else {
                        this.client.on(event.name, listener);
                    }
                    eventListeners.push({ name: event.name, listener });
                    logger.debug(`[PluginManager] Registered event listener: "${event.name}" from plugin "${name}"`);
                }
            }
        }
        this.loadedEvents.set(name, eventListeners);

        this.plugins.set(name, pluginInstance);
        this.activeStatus.set(name, 'loaded');
    }

    /**
     * Enable a loaded plugin.
     * @param {string} name Plugin name
     * @returns {Promise<void>}
     */
    async enable(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin "${name}" tidak ditemukan atau belum di-load.`);
        }

        if (this.activeStatus.get(name) === 'enabled') {
            return;
        }

        logger.info(`[PluginManager] Enabling plugin: "${name}"`);

        // Execute onEnable Lifecycle
        if (typeof plugin.onEnable === 'function') {
            await plugin.onEnable();
        }

        // Execute onReady Lifecycle if Client is already ready
        if (this.client.readyAt && typeof plugin.onReady === 'function') {
            await plugin.onReady();
        }

        this.activeStatus.set(name, 'enabled');
        this.emit('pluginEnable', name);
    }

    /**
     * Disable and unload an active plugin, clearing cache and listeners to prevent leaks.
     * @param {string} name Plugin name
     * @returns {Promise<void>}
     */
    async disable(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            logger.warn(`[PluginManager] Plugin "${name}" tidak aktif.`);
            return;
        }

        logger.info(`[PluginManager] Disabling plugin: "${name}"`);

        // 1. Execute onDisable Lifecycle
        if (typeof plugin.onDisable === 'function') {
            try {
                await plugin.onDisable();
            } catch (err) {
                logger.error(`[PluginManager] Error during onDisable of "${name}":`, err.message);
            }
        }

        // 2. Remove registered commands from client cache
        const commands = this.loadedCommands.get(name) || [];
        for (const cmdName of commands) {
            this.client.commands.delete(cmdName);
            logger.debug(`[PluginManager] Unregistered command "/${cmdName}"`);
        }
        this.loadedCommands.delete(name);

        // 3. Remove registered event listeners
        const events = this.loadedEvents.get(name) || [];
        for (const evt of events) {
            this.client.off(evt.name, evt.listener);
            logger.debug(`[PluginManager] Unregistered event listener "${evt.name}"`);
        }
        this.loadedEvents.delete(name);

        // 4. Clear require caches for hot reload updates
        const meta = this.rawRegistry.get(name);
        if (meta) {
            const pluginDir = path.join(this.pluginsPath, meta.dirName);
            this.clearRequireCache(pluginDir);
        }

        this.plugins.delete(name);
        this.activeStatus.set(name, 'disabled');
        this.emit('pluginDisable', name);
    }

    /**
     * Hot reload a plugin in real-time.
     * @param {string} name Plugin name
     * @returns {Promise<void>}
     */
    async reload(name) {
        logger.info(`[PluginManager] Hot reloading plugin: "${name}"`);
        
        // 1. Disable first
        await this.disable(name);

        // 2. Re-read metadata file
        const meta = this.rawRegistry.get(name);
        if (meta) {
            const metaPath = path.join(this.pluginsPath, meta.dirName, 'plugin.json');
            if (fs.existsSync(metaPath)) {
                try {
                    const newMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    this.rawRegistry.set(name, { ...newMeta, dirName: meta.dirName });
                } catch (e) {
                    logger.warn(`[PluginManager] Gagal memperbarui metadata "${name}" saat reload:`, e.message);
                }
            }
        }

        // 3. Load & Enable again
        await this.load(name);
        await this.enable(name);
        logger.info(`[PluginManager] Plugin "${name}" successfully reloaded.`);
    }

    /**
     * Recursively clears node require cache for files in a directory.
     * @private
     * @param {string} directoryPath Directory path to clear
     */
    clearRequireCache(directoryPath) {
        const resolvedPath = path.resolve(directoryPath);
        for (const cacheId in require.cache) {
            if (cacheId.startsWith(resolvedPath)) {
                delete require.cache[cacheId];
                logger.debug(`[PluginManager] Cleared require cache for file: ${cacheId}`);
            }
        }
    }

    /**
     * Expose list of plugins.
     * @returns {Map<string, object>} Loaded plugins metadata registry
     */
    getPlugins() {
        return this.rawRegistry;
    }
}

module.exports = new PluginManager();
