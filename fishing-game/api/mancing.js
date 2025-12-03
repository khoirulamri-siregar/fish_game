import { createClient } from '@supabase/supabase-js';
import randomizer from '../utils/randomizer.js';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { user_id, rod_id, bait_id } = req.body;
        
        if (!user_id || !rod_id || !bait_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Initialize Supabase
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Verify user exists
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user_id)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get rod data
        const { data: rod, error: rodError } = await supabase
            .from('rods_catalog')
            .select('*')
            .eq('id', rod_id)
            .single();
            
        if (rodError) {
            return res.status(400).json({ error: 'Invalid rod' });
        }
        
        // Get bait data
        const { data: bait, error: baitError } = await supabase
            .from('baits_catalog')
            .select('*')
            .eq('id', bait_id)
            .single();
            
        if (baitError) {
            return res.status(400).json({ error: 'Invalid bait' });
        }
        
        // Check bait quantity
        const { data: userBait, error: userBaitError } = await supabase
            .from('user_baits')
            .select('quantity')
            .eq('user_id', user_id)
            .eq('bait_id', bait_id)
            .single();
            
        if (userBaitError || !userBait || userBait.quantity < 1) {
            return res.status(400).json({ error: 'Insufficient bait' });
        }
        
        // Consume bait
        await supabase
            .from('user_baits')
            .update({ quantity: userBait.quantity - 1 })
            .eq('user_id', user_id)
            .eq('bait_id', bait_id);
        
        // Calculate number of fish to catch
        const baseCatch = 1;
        const extraCatch = rod.extra_catch || 0;
        const catchCount = baseCatch + extraCatch + Math.floor(Math.random() * 2);
        
        // Get rarity chances from settings
        const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'rarity_chances')
            .single();
            
        const rarityChances = settings?.value || {
            common: 50, uncommon: 25, rare: 12, 
            epic: 7, legendary: 4, mythical: 1, secret: 0.2
        };
        
        // Apply rod bonus to rarity chances
        const adjustedChances = { ...rarityChances };
        if (rod.rarity_bonus_percent > 0) {
            // Shift probability to higher rarities
            const bonus = rod.rarity_bonus_percent / 100;
            const shiftAmount = 0.1 * bonus; // Simple shift
            // Adjust probabilities (simplified)
        }
        
        // Get fish catalog
        const { data: allFish, error: fishError } = await supabase
            .from('fish_catalog')
            .select('*');
            
        if (fishError) {
            return res.status(500).json({ error: 'Failed to load fish data' });
        }
        
        // Group fish by rarity
        const fishByRarity = {};
        allFish.forEach(fish => {
            if (!fishByRarity[fish.rarity]) {
                fishByRarity[fish.rarity] = [];
            }
            fishByRarity[fish.rarity].push(fish);
        });
        
        // Catch fish
        const caughtFish = [];
        let totalValue = 0;
        let totalXP = 0;
        
        for (let i = 0; i < catchCount; i++) {
            // Choose rarity
            const rarity = randomizer.chooseRarity(adjustedChances);
            
            // Choose fish within rarity
            const fishList = fishByRarity[rarity];
            if (!fishList || fishList.length === 0) continue;
            
            const fishTemplate = randomizer.chooseFishInRarity(fishList);
            
            // Calculate weight with rod bonus
            const weight = randomizer.calcWeight(
                fishTemplate.min_w, 
                fishTemplate.max_w, 
                rod.weight_bonus_percent || 0
            );
            
            // Calculate value
            const value = randomizer.calcValue(
                fishTemplate.base_value, 
                weight, 
                fishTemplate.rarity
            );
            
            // Calculate XP
            const xp = Math.floor(value / 10);
            
            // Create fish record
            const fishRecord = {
                user_id: user_id,
                fish_key: fishTemplate.key,
                fish_name: fishTemplate.name,
                rarity: fishTemplate.rarity,
                weight: weight,
                value: value,
                emoji: fishTemplate.emoji,
                caught_at: new Date().toISOString()
            };
            
            // Save to database
            const { data: savedFish, error: saveError } = await supabase
                .from('fishes')
                .insert([fishRecord])
                .select()
                .single();
                
            if (saveError) {
                console.error('Error saving fish:', saveError);
                continue;
            }
            
            caughtFish.push({
                ...fishRecord,
                id: savedFish.id
            });
            
            totalValue += value;
            totalXP += xp;
        }
        
        if (caughtFish.length > 0) {
            // Update user stats
            const updateData = {
                money: user.money + totalValue,
                xp: user.xp + totalXP,
                total_fishes: user.total_fishes + caughtFish.length,
                level: Math.floor(Math.sqrt((user.xp + totalXP) / 50)),
                updated_at: new Date().toISOString()
            };
            
            await supabase
                .from('users')
                .update(updateData)
                .eq('id', user_id);
        }
        
        // Return results
        return res.status(200).json({
            success: true,
            fishes: caughtFish,
            total_value: totalValue,
            total_xp: totalXP,
            rod_used: rod.name,
            bait_used: bait.name
        });
        
    } catch (error) {
        console.error('Mancing error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}