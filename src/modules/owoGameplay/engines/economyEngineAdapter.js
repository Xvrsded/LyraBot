class EconomyEngineAdapter {
    async execute(context) {
        // Bridge to Module 14 Economy
        // Extract coins gained from payload if any
        const coins = context.payload.coins || 0;
        
        if (coins > 0) {
            // RewardDistributor.grantCoins(context.userId, coins)
            context.setMetadata('EconomyAdapter', { coinsGranted: coins });
        } else {
            context.setMetadata('EconomyAdapter', { coinsGranted: 0 });
        }
    }
}

module.exports = new EconomyEngineAdapter();
