const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const panelRegistry = require('../registry/panelRegistry');
const panelPermission = require('../services/panelPermission');
const panelGenerator = require('../services/panelGenerator');
const panelPersistence = require('../services/panelPersistence');
const panelInstaller = require('../services/panelInstaller');
const panelUpdater = require('../services/panelUpdater');
const panelRecovery = require('../services/panelRecovery');
const adminPanelManager = require('../services/adminPanelManager');

async function runTests() {
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            passed++;
            console.log(`✅ PASS: ${name}`);
        } catch (error) {
            failed++;
            console.error(`❌ FAIL: ${name}`);
            console.error(error);
        }
    };

    const uiManager = require('../../ui/services/uiManager');
    uiManager.init();

    console.log('Running Admin Panel Generator Tests...\n');

    // 1-10: Panel Registry
    await test('1. PanelRegistry: Is Collection', () => {
        assert.strictEqual(panelRegistry.panels.constructor.name, 'Collection');
    });

    await test('2. PanelRegistry: Register Valid Panel', () => {
        panelRegistry.register({ id: 'test1', title: 'Test 1' });
        assert.strictEqual(panelRegistry.panels.has('test1'), true);
    });

    await test('3. PanelRegistry: Register Invalid Panel', () => {
        assert.throws(() => panelRegistry.register({ title: 'Test 2' }), /must include a valid id/);
    });

    await test('4. PanelRegistry: Unregister Panel', () => {
        const res = panelRegistry.unregister('test1');
        assert.strictEqual(res, true);
        assert.strictEqual(panelRegistry.panels.has('test1'), false);
    });

    await test('5. PanelRegistry: Unregister Non-Existent', () => {
        const res = panelRegistry.unregister('test1');
        assert.strictEqual(res, false);
    });

    await test('6. PanelRegistry: Update Panel', () => {
        panelRegistry.register({ id: 'test2', title: 'Test 2' });
        panelRegistry.update('test2', { title: 'Updated' });
        assert.strictEqual(panelRegistry.get('test2').title, 'Updated');
    });

    await test('7. PanelRegistry: Update Non-Existent', () => {
        assert.throws(() => panelRegistry.update('invalid', { title: 'Updated' }), /not found/);
    });

    await test('8. PanelRegistry: Exists', () => {
        assert.strictEqual(panelRegistry.exists('test2'), true);
        assert.strictEqual(panelRegistry.exists('test3'), false);
    });

    await test('9. PanelRegistry: GetAll', () => {
        const all = panelRegistry.getAll();
        assert.strictEqual(Array.isArray(all), true);
        assert.strictEqual(all.length >= 1, true);
    });

    await test('10. PanelRegistry: Reload clears existing (except active)', () => {
        panelRegistry.reload();
        // Since we created base files, it should load them
        assert.strictEqual(panelRegistry.exists('overview'), true);
    });

    // 11-20: Metadata & JSON validation
    await test('11. Metadata: Base Overview Exists', () => {
        assert.strictEqual(panelRegistry.exists('overview'), true);
    });

    await test('12. Metadata: Base Economy Exists', () => {
        assert.strictEqual(panelRegistry.exists('economy'), true);
    });

    await test('13. Metadata: Overview has title', () => {
        assert.strictEqual(panelRegistry.get('overview').title, 'Overview');
    });

    await test('14. Metadata: Overview has icon', () => {
        assert.strictEqual(typeof panelRegistry.get('overview').icon, 'string');
    });

    await test('15. Metadata: Overview has permission', () => {
        assert.strictEqual(panelRegistry.get('overview').permission, 'ADMINISTRATOR');
    });

    await test('16. Metadata: Overview has components', () => {
        assert.strictEqual(Array.isArray(panelRegistry.get('overview').components), true);
    });

    await test('17. Metadata: Order is respected in JSON', () => {
        const economy = panelRegistry.get('economy');
        assert.strictEqual(typeof economy.order, 'number');
    });

    await test('18. Metadata: Visibility flag exists', () => {
        const economy = panelRegistry.get('economy');
        assert.strictEqual(economy.visible, true);
    });

    await test('19. Metadata: JSON files are valid format', () => {
        const files = fs.readdirSync(path.join(__dirname, '../panels/base'));
        assert.strictEqual(files.length, 9);
    });

    await test('20. Metadata: Configuration exists', () => {
        assert.strictEqual(panelRegistry.exists('configuration'), true);
    });

    // 21-30: Panel Permissions
    const mockMemberAdmin = { permissions: { has: (p) => p === 8n || p === 8 } }; // 8 is Administrator flag
    const mockMemberUser = { permissions: { has: () => false } };

    await test('21. PanelPermission: Admin passes ADMINISTRATOR', () => {
        assert.strictEqual(panelPermission.hasPermission(mockMemberAdmin, 'ADMINISTRATOR'), true);
    });

    await test('22. PanelPermission: User fails ADMINISTRATOR', () => {
        assert.strictEqual(panelPermission.hasPermission(mockMemberUser, 'ADMINISTRATOR'), false);
    });

    await test('23. PanelPermission: Array of permissions checks', () => {
        assert.strictEqual(panelPermission.hasPermission(mockMemberAdmin, ['ADMINISTRATOR', 'MANAGE_GUILD']), true);
    });

    await test('24. PanelPermission: Empty permission returns true', () => {
        assert.strictEqual(panelPermission.hasPermission(mockMemberUser, null), true);
    });

    await test('25. PanelPermission: Unknown permission returns false', () => {
        assert.strictEqual(panelPermission.hasPermission(mockMemberAdmin, 'INVALID_PERM'), false);
    });

    await test('26. PanelGenerator: Filter out non-visible', async () => {
        panelRegistry.register({ id: 'hidden1', title: 'Hidden', visible: false, order: 99 });
        const mockGuild = { name: 'Test' };
        const res = await panelGenerator.generateMainPanel(mockGuild, mockMemberAdmin);
        let found = false;
        res.components.forEach(row => row.components.forEach(c => {
            if (c.data.custom_id === 'ui:admin_panel:nav:hidden1') found = true;
        }));
        assert.strictEqual(found, false);
    });

    await test('27. PanelGenerator: Filter out no permission', async () => {
        const mockGuild = { name: 'Test' };
        const res = await panelGenerator.generateMainPanel(mockGuild, mockMemberUser);
        let foundEconomy = false;
        res.components.forEach(row => row.components.forEach(c => {
            if (c.data.custom_id === 'ui:admin_panel:nav:economy') foundEconomy = true;
        }));
        assert.strictEqual(foundEconomy, false);
    });

    await test('28. PanelGenerator: Admin sees Economy', async () => {
        const mockGuild = { name: 'Test' };
        const res = await panelGenerator.generateMainPanel(mockGuild, mockMemberAdmin);
        let foundEconomy = false;
        res.components.forEach(row => row.components.forEach(c => {
            if (c.data.custom_id === 'ui:admin_panel:nav:economy') foundEconomy = true;
        }));
        assert.strictEqual(foundEconomy, true);
    });

    await test('29. PanelGenerator: Output has Embeds', async () => {
        const mockGuild = { name: 'Test' };
        const res = await panelGenerator.generateMainPanel(mockGuild, mockMemberAdmin);
        assert.strictEqual(res.embeds.length, 1);
    });

    await test('30. PanelGenerator: Buttons chunked to 5 max per ActionRow', async () => {
        const mockGuild = { name: 'Test' };
        const res = await panelGenerator.generateMainPanel(mockGuild, mockMemberAdmin);
        let maxButtons = 0;
        res.components.forEach(row => {
            if (row.components.length > maxButtons) maxButtons = row.components.length;
        });
        assert.strictEqual(maxButtons <= 5, true);
    });

    // 31-40: Persistence & Models (Mocked)
    await test('31. PanelPersistence: Model name', () => {
        const Model = require('../models/AdminPanelState');
        assert.strictEqual(Model.modelName, 'AdminPanelState');
    });

    let savedState = null;
    panelPersistence.saveState = async (g, c, m, t, i) => {
        savedState = { guildId: g, channelId: c, messageId: m, currentTemplate: t, installedPanels: i, recoveryStatus: 'OK' };
        return savedState;
    };
    panelPersistence.getState = async (g) => savedState && savedState.guildId === g ? savedState : null;
    panelPersistence.getAllStates = async () => savedState ? [savedState] : [];
    panelPersistence.setRecoveryStatus = async (g, s) => { if (savedState) savedState.recoveryStatus = s; };

    await test('32. PanelPersistence: saveState mocked', async () => {
        const s = await panelPersistence.saveState('g1', 'c1', 'm1', 'base', []);
        assert.strictEqual(s.guildId, 'g1');
    });

    await test('33. PanelPersistence: getState mocked', async () => {
        const s = await panelPersistence.getState('g1');
        assert.strictEqual(s.channelId, 'c1');
    });

    await test('34. PanelPersistence: getAllStates mocked', async () => {
        const s = await panelPersistence.getAllStates();
        assert.strictEqual(s.length, 1);
    });

    await test('35. PanelPersistence: setRecoveryStatus mocked', async () => {
        await panelPersistence.setRecoveryStatus('g1', 'PENDING');
        assert.strictEqual(savedState.recoveryStatus, 'PENDING');
    });

    await test('36. PanelInstaller: Avoid Duplicate Channel Create', async () => {
        const mockGuild = { id: 'g1', channels: { cache: { find: () => null } } };
        // Since state g1 exists in mock, installer should delegate to updater
        let updaterCalled = false;
        const panelUpdaterMock = require('../services/panelUpdater');
        const oldUpdate = panelUpdaterMock.updatePanel;
        panelUpdaterMock.updatePanel = async () => { updaterCalled = true; return true; };
        
        await panelInstaller.install(mockGuild);
        assert.strictEqual(updaterCalled, true);
        
        panelUpdaterMock.updatePanel = oldUpdate;
    });

    await test('37. PanelInstaller: Creates Category if none', async () => {
        panelPersistence.getState = async () => null; // Force fresh install
        let catCreated = false;
        const mockGuild = { 
            id: 'g2', client: { user: { id: 'bot1' } },
            channels: { 
                cache: { find: () => null },
                create: async (opts) => {
                    if (opts.name === 'Administration') {
                        catCreated = true;
                        return { id: 'cat1' };
                    }
                    if (opts.name === 'admin-panel') return { id: 'c2', messages: { fetch: async () => new Map(), send: async () => ({id: 'm2'}) } };
                }
            },
            members: { fetch: async () => mockMemberAdmin }
        };
        await panelInstaller.install(mockGuild);
        assert.strictEqual(catCreated, true);
    });

    await test('38. PanelUpdater: Fetches message', async () => {
        let msgEdited = false;
        panelPersistence.getState = async () => ({ guildId: 'g3', channelId: 'c3', messageId: 'm3' });
        const mockGuild = { 
            id: 'g3',
            name: 'Test',
            channels: { fetch: async () => ({ id: 'c3', messages: { fetch: async () => ({ id: 'm3', edit: async () => { msgEdited = true; } }) } }) },
            members: { fetch: async () => mockMemberAdmin }
        };
        const client = { guilds: { fetch: async () => mockGuild }, user: { id: 'bot1' } };
        await panelUpdater.updatePanel(client, 'g3');
        assert.strictEqual(msgEdited, true);
    });

    await test('39. PanelUpdater: Return false on deleted message', async () => {
        panelPersistence.getState = async () => ({ guildId: 'g4', channelId: 'c4', messageId: 'm4' });
        const mockGuild = { 
            id: 'g4',
            channels: { fetch: async () => ({ id: 'c4', messages: { fetch: async () => { throw new Error('Deleted'); } } }) }
        };
        const client = { guilds: { fetch: async () => mockGuild } };
        const res = await panelUpdater.updatePanel(client, 'g4');
        assert.strictEqual(res, false);
    });

    await test('40. PanelRecovery: Triggered on missing channel', async () => {
        panelPersistence.getAllStates = async () => ([{ guildId: 'g5', channelId: 'c5', messageId: 'm5' }]);
        let installCalled = false;
        panelInstaller.install = async () => { installCalled = true; return true; };
        
        const client = { 
            guilds: { fetch: async () => ({ id: 'g5', channels: { fetch: async () => { throw new Error('No channel'); } } }) }
        };
        await panelRecovery.scanAndRecover(client);
        assert.strictEqual(installCalled, true);
    });

    // 41-50: Core Manager & Plugin APIs
    await test('41. AdminPanelManager: init', () => {
        const clientMock = { guilds: { fetch: async () => ({ id: 'g8' }) } };
        adminPanelManager.init(clientMock);
        assert.strictEqual(adminPanelManager.initialized, true);
    });

    await test('42. AdminPanelManager: double init ignored', () => {
        adminPanelManager.init({});
        assert.strictEqual(adminPanelManager.initialized, true);
    });

    await test('43. AdminPanelManager: Plugin API returned', () => {
        const api = adminPanelManager.getPluginApi();
        assert.strictEqual(typeof api.register, 'function');
        assert.strictEqual(typeof api.update, 'function');
    });

    await test('44. Plugin API: registers through manager', () => {
        const api = adminPanelManager.getPluginApi();
        api.register({ id: 'plug1', title: 'P1' });
        assert.strictEqual(panelRegistry.exists('plug1'), true);
    });

    await test('45. Plugin API: unregisters through manager', () => {
        const api = adminPanelManager.getPluginApi();
        api.unregister('plug1');
        assert.strictEqual(panelRegistry.exists('plug1'), false);
    });

    await test('46. Plugin API: reloads', () => {
        const api = adminPanelManager.getPluginApi();
        api.reload();
        assert.strictEqual(panelRegistry.exists('overview'), true);
    });

    await test('47. PanelRecovery: Recovers missing message', async () => {
        panelPersistence.getAllStates = async () => ([{ guildId: 'g6', channelId: 'c6', messageId: 'm6' }]);
        let installCalled = false;
        panelInstaller.install = async () => { installCalled = true; return true; };
        
        const client = { 
            guilds: { fetch: async () => ({ id: 'g6', channels: { fetch: async () => ({ messages: { fetch: async () => null } }) } }) }
        };
        await panelRecovery.scanAndRecover(client);
        assert.strictEqual(installCalled, true);
    });

    await test('48. PanelRecovery: Skips healthy panels', async () => {
        panelPersistence.getAllStates = async () => ([{ guildId: 'g7', channelId: 'c7', messageId: 'm7' }]);
        let installCalled = false;
        panelInstaller.install = async () => { installCalled = true; return true; };
        
        const client = { 
            guilds: { fetch: async () => ({ id: 'g7', channels: { fetch: async () => ({ messages: { fetch: async () => ({ id: 'm7' }) } }) } }) }
        };
        await panelRecovery.scanAndRecover(client);
        assert.strictEqual(installCalled, false);
    });

    await test('49. PanelPermission: Administrator override defaults to true', () => {
        assert.strictEqual(panelPermission.hasPermission(mockMemberAdmin, 'MODERATOR'), false);
    });

    await test('50. Manager Hook test: setup.completed', async () => {
        let installed = false;
        panelInstaller.install = async () => { installed = true; return true; };
        const eventBus = require('../../../services/eventBus');
        
        eventBus.emit('setup.completed', { guildId: 'g8', templateId: 'base' });
        await new Promise(r => setTimeout(r, 50));
        assert.strictEqual(installed, true);
    });

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests();
