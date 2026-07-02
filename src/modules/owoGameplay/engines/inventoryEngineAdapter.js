class InventoryEngineAdapter {
    async execute(context) {
        // Bridge to Module 15 Inventory
        const loot = context.payload.loot || [];
        
        if (loot.length > 0) {
            context.setMetadata('InventoryAdapter', { itemsGranted: loot.length });
        } else {
            context.setMetadata('InventoryAdapter', { itemsGranted: 0 });
        }
    }
}

module.exports = new InventoryEngineAdapter();
