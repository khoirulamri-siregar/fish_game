class Randomizer {
    // Choose rarity based on probabilities
    chooseRarity(rarityChances) {
        const total = Object.values(rarityChances).reduce((a, b) => a + b, 0);
        let random = Math.random() * total;
        
        for (const [rarity, chance] of Object.entries(rarityChances)) {
            random -= chance;
            if (random <= 0) {
                return rarity;
            }
        }
        
        return 'common'; // fallback
    }
    
    // Choose fish within rarity using weighted random
    chooseFishInRarity(fishList) {
        const totalWeight = fishList.reduce((sum, fish) => sum + fish.relative_weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const fish of fishList) {
            random -= fish.relative_weight;
            if (random <= 0) {
                return fish;
            }
        }
        
        return fishList[0]; // fallback
    }
    
    // Calculate weight with bonus
    calcWeight(min, max, weightBonusPercent = 0) {
        const baseWeight = min + (Math.random() * (max - min));
        const bonus = 1 + (weightBonusPercent / 100);
        const finalWeight = baseWeight * bonus;
        return Math.round(finalWeight * 100) / 100; // 2 decimal places
    }
    
    // Calculate value based on weight and rarity
    calcValue(baseValue, weight, rarity) {
        const rarityMultipliers = {
            common: 1,
            uncommon: 1.5,
            rare: 2,
            epic: 4,
            legendary: 8,
            mythical: 25,
            secret: 50
        };
        
        const multiplier = rarityMultipliers[rarity] || 1;
        const value = Math.floor(baseValue * weight * multiplier);
        return Math.max(value, 1); // Ensure at least 1 value
    }
}

// Export singleton instance
export default new Randomizer();

// Unit tests for the randomizer
if (process.env.NODE_ENV === 'test') {
    const testRandomizer = new Randomizer();
    
    // Test chooseRarity
    const testChances = {
        common: 50,
        uncommon: 25,
        rare: 12,
        epic: 7,
        legendary: 4,
        mythical: 1,
        secret: 0.2
    };
    
    const rarityCounts = {};
    for (let i = 0; i < 10000; i++) {
        const rarity = testRandomizer.chooseRarity(testChances);
        rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;
    }
    
    console.log('Rarity distribution test:', rarityCounts);
    
    // Test calcWeight
    const weight = testRandomizer.calcWeight(1, 10, 20);
    console.log('Weight calculation (1-10 with 20% bonus):', weight);
    
    // Test calcValue
    const value = testRandomizer.calcValue(100, 5, 'rare');
    console.log('Value calculation (base 100, weight 5, rare):', value);
}