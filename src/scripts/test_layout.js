const layoutManager = require('../services/layoutManager');
const assert = require('assert');

async function test() {
    // 1. Test minimalist
    const p1 = layoutManager.parseCategoryName('╭ ✦・INFORMATION');
    assert.strictEqual(p1, 'INFORMATION');
    
    const p2 = layoutManager.parseChannelName('✦・💬general');
    assert.strictEqual(p2.name, 'general');
    assert.strictEqual(p2.icon, '💬');

    const p3 = layoutManager.parseChannelName('『💬』・bot-commands');
    assert.strictEqual(p3.name, 'bot-commands');
    assert.strictEqual(p3.icon, '💬');

    const p4 = layoutManager.parseChannelName('🔧│support');
    assert.strictEqual(p4.name, 'support');
    assert.strictEqual(p4.icon, '🔧');
    
    const p5 = layoutManager.parseChannelName('random-text-channel');
    assert.strictEqual(p5.name, 'random-text-channel');
    assert.strictEqual(p5.icon, '💬'); // default

    console.log('Parser tests passed!');
}

test().catch(console.error);
