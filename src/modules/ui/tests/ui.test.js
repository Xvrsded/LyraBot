const assert = require('assert');
const sessionManager = require('../services/sessionManager');
const panelManager = require('../services/panelManager');
const pageManager = require('../services/pageManager');
const componentManager = require('../services/componentManager');
const uiManager = require('../services/uiManager');

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

    console.log('Running UI Framework Tests...\n');

    // --- Component Manager Tests (1-10) ---
    await test('1. ComponentManager: Create Primary Button', () => {
        const btn = componentManager.createButton({ id: 'btn1', label: 'Test', style: 1 });
        assert.strictEqual(btn.data.custom_id, 'btn1');
        assert.strictEqual(btn.data.style, 1);
    });

    await test('2. ComponentManager: Create Danger Button', () => {
        const btn = componentManager.createButton({ id: 'btn2', label: 'Delete', style: 4 });
        assert.strictEqual(btn.data.style, 4);
    });

    await test('3. ComponentManager: Create Button with Emoji', () => {
        const btn = componentManager.createButton({ id: 'btn3', emoji: '🎉' });
        assert.strictEqual(btn.data.emoji.name, '🎉');
    });

    await test('4. ComponentManager: Create Disabled Button', () => {
        const btn = componentManager.createButton({ id: 'btn4', disabled: true });
        assert.strictEqual(btn.data.disabled, true);
    });

    await test('5. ComponentManager: Create Select Menu', () => {
        const select = componentManager.createSelectMenu({ id: 'sel1', options: [{label: 'A', value: 'a'}, {label: 'B', value: 'b'}] });
        assert.strictEqual(select.data.custom_id, 'sel1');
        assert.strictEqual(select.options.length, 2);
    });

    await test('6. ComponentManager: Select Menu Defaults', () => {
        const select = componentManager.createSelectMenu({ id: 'sel2', options: [{label: 'A', value: 'a', default: true}] });
        assert.strictEqual(select.options[0].data.default, true);
    });

    await test('7. ComponentManager: Create Modal', () => {
        const modal = componentManager.createModal({ id: 'mod1', title: 'Test', inputs: [{ id: 'in1', label: 'Input 1' }] });
        assert.strictEqual(modal.data.custom_id, 'mod1');
        assert.strictEqual(modal.data.title, 'Test');
    });

    await test('8. ComponentManager: Create Embed', () => {
        const embed = componentManager.createEmbed({ title: 'Hello', color: 0xFF0000 });
        assert.strictEqual(embed.data.title, 'Hello');
        assert.strictEqual(embed.data.color, 0xFF0000);
    });

    await test('9. ComponentManager: Embed Fields', () => {
        const embed = componentManager.createEmbed({ fields: [{ name: 'A', value: 'B' }] });
        assert.strictEqual(embed.data.fields.length, 1);
    });

    await test('10. ComponentManager: Action Row', () => {
        const btn = componentManager.createButton({ id: 'b', label: 'B' });
        const row = componentManager.createActionRow([btn]);
        assert.strictEqual(row.components.length, 1);
    });

    // --- Panel & Page Manager Tests (11-20) ---
    await test('11. PanelManager: Register Panel', () => {
        const panel = panelManager.registerPanel({ id: 'p1', title: 'Panel 1' });
        assert.strictEqual(panel.title, 'Panel 1');
    });

    await test('12. PanelManager: Get Panel', () => {
        const panel = panelManager.getPanel('p1');
        assert.strictEqual(panel.id, 'p1');
    });

    await test('13. PanelManager: Invalid Registration', () => {
        assert.throws(() => panelManager.registerPanel({}), /must contain a valid id/);
    });

    await test('14. PageManager: Register Page', () => {
        const page = pageManager.registerPage('p1', { id: 'idx', render: () => {} });
        assert.strictEqual(page.id, 'idx');
    });

    await test('15. PageManager: Get Page', () => {
        const page = pageManager.getPage('p1', 'idx');
        assert.strictEqual(page.id, 'idx');
    });

    await test('16. PageManager: Invalid Registration', () => {
        assert.throws(() => pageManager.registerPage('p1', { id: 'idx' }), /Must have id and render function/);
    });

    await test('17. PanelManager: Default Pages', () => {
        const p2 = panelManager.registerPanel({ id: 'p2' });
        assert.deepStrictEqual(p2.pages, ['index']);
    });

    await test('18. PanelManager: Has Parent', () => {
        const p3 = panelManager.registerPanel({ id: 'p3', parentPanel: 'p1' });
        assert.strictEqual(p3.parentPanel, 'p1');
    });

    await test('19. PanelManager: Default Permissions', () => {
        const p4 = panelManager.registerPanel({ id: 'p4' });
        assert.deepStrictEqual(p4.permissions, []);
    });

    await test('20. PanelManager: Custom Components array', () => {
        const p5 = panelManager.registerPanel({ id: 'p5', components: [{type: 'button'}] });
        assert.strictEqual(p5.components.length, 1);
    });

    // --- Session Manager Tests (21-30) ---
    const gid = 'g1', cid = 'c1', mid = 'm1', uid = 'u1';

    await test('21. SessionManager: Create Session', () => {
        const s = sessionManager.setSession(gid, cid, mid, uid, 'p1', 'idx');
        assert.strictEqual(s.panelId, 'p1');
    });

    await test('22. SessionManager: Get Session', () => {
        const s = sessionManager.getSession(gid, cid, mid, uid);
        assert.strictEqual(s.panelId, 'p1');
    });

    await test('23. SessionManager: Update Session Data', () => {
        const s = sessionManager.setSession(gid, cid, mid, uid, 'p1', 'idx', { count: 1 });
        assert.strictEqual(s.data.count, 1);
    });

    await test('24. SessionManager: Session Key Gen', () => {
        const key = sessionManager._getKey(gid, cid, mid, uid);
        assert.strictEqual(key, 'g1:c1:m1:u1');
    });

    await test('25. SessionManager: Session History Empty Init', () => {
        const s = sessionManager.getSession(gid, cid, mid, uid);
        assert.strictEqual(s.history.length, 0);
    });

    await test('26. SessionManager: Navigate pushes History', () => {
        sessionManager.navigate(gid, cid, mid, uid, 'p1', 'page2');
        const s = sessionManager.getSession(gid, cid, mid, uid);
        assert.strictEqual(s.history.length, 1);
        assert.strictEqual(s.history[0].pageId, 'idx');
        assert.strictEqual(s.pageId, 'page2');
    });

    await test('27. SessionManager: Navigate multiple times', () => {
        sessionManager.navigate(gid, cid, mid, uid, 'p1', 'page3');
        const s = sessionManager.getSession(gid, cid, mid, uid);
        assert.strictEqual(s.history.length, 2);
    });

    await test('28. SessionManager: GoBack pops History', () => {
        sessionManager.goBack(gid, cid, mid, uid);
        const s = sessionManager.getSession(gid, cid, mid, uid);
        assert.strictEqual(s.history.length, 1);
        assert.strictEqual(s.pageId, 'page2');
    });

    await test('29. SessionManager: Destroy Session', () => {
        sessionManager.destroySession(gid, cid, mid, uid);
        const s = sessionManager.getSession(gid, cid, mid, uid);
        assert.strictEqual(s, undefined);
    });

    await test('30. SessionManager: GoBack on empty session returns null', () => {
        const b = sessionManager.goBack(gid, cid, mid, 'u2');
        assert.strictEqual(b, null);
    });

    // --- Timeout & Memory Leak Tests (31-36) ---
    await test('31. SessionManager: Memory leak on creation prevention (timeout clears)', async () => {
        sessionManager.setSession(gid, cid, mid, 'u3', 'p1');
        assert.strictEqual(sessionManager.sessions.size, 1);
    });

    await test('32. SessionManager: Timeout Execution', async () => {
        // Mock SESSION_TIMEOUT temporarily
        const oldTimeout = sessionManager.SESSION_TIMEOUT;
        sessionManager.SESSION_TIMEOUT = 50;
        sessionManager.setSession(gid, cid, mid, 'u4', 'p1');
        
        await new Promise(r => setTimeout(r, 60));
        const s = sessionManager.getSession(gid, cid, mid, 'u4');
        assert.strictEqual(s, undefined);
        sessionManager.SESSION_TIMEOUT = oldTimeout;
    });

    await test('33. SessionManager: Refresh Session resets timeout', async () => {
        sessionManager.SESSION_TIMEOUT = 100;
        sessionManager.setSession(gid, cid, mid, 'u5', 'p1');
        await new Promise(r => setTimeout(r, 60));
        // Refresh session by navigating to same page
        sessionManager.setSession(gid, cid, mid, 'u5', 'p1');
        await new Promise(r => setTimeout(r, 60)); // Total 120ms, if not refreshed it would be dead
        const s = sessionManager.getSession(gid, cid, mid, 'u5');
        assert.notStrictEqual(s, undefined);
        sessionManager.destroySession(gid, cid, mid, 'u5'); // cleanup
    });

    await test('34. UI Manager: Init', () => {
        uiManager.init();
        assert.strictEqual(uiManager.initialized, true);
    });

    await test('35. UI Manager: Multiple Init Ignored', () => {
        uiManager.init(); // second time
        assert.strictEqual(uiManager.initialized, true);
    });

    await test('36. UI Manager: Exposed properties', () => {
        assert.strictEqual(!!uiManager.components, true);
        assert.strictEqual(!!uiManager.navigation, true);
    });

    // --- Router & Renderer Tests (37-40) ---
    const router = require('../utils/router');
    const renderer = require('../services/renderer');

    await test('37. Router: Ignore non-UI interactions', async () => {
        const handled = await router.handleInteraction({ customId: 'admin_btn' });
        assert.strictEqual(handled, false);
    });

    await test('38. Router: Reject malformed UI ids', async () => {
        const handled = await router.handleInteraction({ customId: 'ui:shop' });
        assert.strictEqual(handled, false);
    });

    await test('39. Router: Parse valid UI action', async () => {
        let emitted = false;
        const eventBus = require('../../../services/eventBus');
        eventBus.subscribe('ui.action.shop.buy:123', () => { emitted = true; });
        
        const mockInteraction = { 
            customId: 'ui:shop:action:buy:123', 
            isButton: () => true, 
            user: { id: 'u1' },
            deferUpdate: async () => {},
            replied: false, deferred: false 
        };
        const handled = await router.handleInteraction(mockInteraction);
        
        assert.strictEqual(handled, true);
        assert.strictEqual(emitted, true);
    });

    await test('40. Renderer: Missing Session Handling', async () => {
        let replied = false;
        const mockInteraction = {
            isMessageComponent: () => true,
            deferred: false, replied: false,
            update: async () => { replied = true; }
        };
        await renderer.render(mockInteraction, null);
        assert.strictEqual(replied, true);
    });

    // Cleanup
    sessionManager.sessions.clear();

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

runTests();
