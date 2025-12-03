// Initialize Supabase
const supabase = window.supabase.createClient(
    'https://zumpzpccycngnlppxznz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bXB6cGNjeWNuZ25scHB4em56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTU0NDMsImV4cCI6MjA4MDMzMTQ0M30.5RnFCJuWWST-VhJxOwErCkqE3MUAZtfBxuPZSiervlA'
);

let currentUser = null;
let userData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadInventory();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;
    
    // Load user data
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', currentUser.id)
        .single();
    userData = data;
}

async function loadInventory() {
    await loadFish();
    await loadRods();
    await loadBaits();
}

async function loadFish() {
    const { data: fish, error } = await supabase
        .from('fishes')
        .select('*')
        .eq('user_id', userData.id)
        .order('caught_at', { ascending: false });
    
    if (error) {
        console.error('Error loading fish:', error);
        return;
    }
    
    const fishGrid = document.getElementById('fishGrid');
    fishGrid.innerHTML = '';
    
    if (fish.length === 0) {
        fishGrid.innerHTML = '<p>No fish caught yet! Go fishing!</p>';
        return;
    }
    
    fish.forEach(f => {
        const fishCard = document.createElement('div');
        fishCard.className = 'inventory-item';
        fishCard.innerHTML = `
            <span class="emoji">${f.emoji || '🐟'}</span>
            <h4>${f.fish_name}</h4>
            <p>${f.weight}kg</p>
            <p class="rarity-${f.rarity}">${f.rarity}</p>
            <p>💰 ${f.value}</p>
            <button onclick="sellFish('${f.id}', ${f.value})" class="sell-btn">
                Sell
            </button>
        `;
        fishGrid.appendChild(fishCard);
    });
}

async function loadRods() {
    const { data: rods, error } = await supabase
        .from('user_rods')
        .select('rod_id, equipped')
        .eq('user_id', userData.id);
    
    if (error) {
        console.error('Error loading rods:', error);
        return;
    }
    
    const rodsList = document.getElementById('rodsList');
    rodsList.innerHTML = '';
    
    // Get rod details
    for (const userRod of rods) {
        const { data: rodInfo } = await supabase
            .from('rods_catalog')
            .select('*')
            .eq('id', userRod.rod_id)
            .single();
        
        if (rodInfo) {
            const rodDiv = document.createElement('div');
            rodDiv.className = 'shop-item';
            rodDiv.innerHTML = `
                <span class="emoji">${rodInfo.emoji}</span>
                <h4>${rodInfo.name}</h4>
                <p>Extra catch: +${rodInfo.extra_catch}</p>
                <p>Rarity bonus: +${rodInfo.rarity_bonus_percent}%</p>
                <p>Weight bonus: +${rodInfo.weight_bonus_percent}%</p>
                ${userRod.equipped ? 
                    '<button class="pixel-btn" disabled>✅ Equipped</button>' : 
                    `<button class="pixel-btn" onclick="equipRod('${userRod.rod_id}')">
                        Equip
                    </button>`
                }
            `;
            rodsList.appendChild(rodDiv);
        }
    }
}

async function loadBaits() {
    const { data: baits, error } = await supabase
        .from('user_baits')
        .select('bait_id, quantity')
        .eq('user_id', userData.id);
    
    if (error) {
        console.error('Error loading baits:', error);
        return;
    }
    
    const baitsList = document.getElementById('baitsList');
    baitsList.innerHTML = '';
    
    for (const userBait of baits) {
        const { data: baitInfo } = await supabase
            .from('baits_catalog')
            .select('*')
            .eq('id', userBait.bait_id)
            .single();
        
        if (baitInfo) {
            const baitDiv = document.createElement('div');
            baitDiv.className = 'shop-item';
            baitDiv.innerHTML = `
                <span class="emoji">${baitInfo.emoji}</span>
                <h4>${baitInfo.name}</h4>
                <p>Charges: ${userBait.quantity}</p>
                <p>Price: 💰 ${baitInfo.price}</p>
                <p>${baitInfo.description}</p>
            `;
            baitsList.appendChild(baitDiv);
        }
    }
}

async function sellFish(fishId, value) {
    if (!confirm(`Sell this fish for 💰${value}?`)) return;
    
    // Delete fish
    const { error } = await supabase
        .from('fishes')
        .delete()
        .eq('id', fishId);
    
    if (error) {
        alert('Error selling fish');
        return;
    }
    
    // Update user money
    await supabase
        .from('users')
        .update({ 
            money: userData.money + value,
            updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);
    
    // Reload inventory
    await loadInventory();
    showNotification(`Sold for 💰${value}!`, 'success');
}

async function sellAllFish() {
    // Get all common fish
    const { data: commonFish } = await supabase
        .from('fishes')
        .select('id, value')
        .eq('user_id', userData.id)
        .eq('rarity', 'common');
    
    if (!commonFish || commonFish.length === 0) {
        showNotification('No common fish to sell!', 'info');
        return;
    }
    
    const totalValue = commonFish.reduce((sum, fish) => sum + fish.value, 0);
    
    if (!confirm(`Sell all ${commonFish.length} common fish for 💰${totalValue}?`)) {
        return;
    }
    
    // Delete all common fish
    const { error } = await supabase
        .from('fishes')
        .delete()
        .eq('user_id', userData.id)
        .eq('rarity', 'common');
    
    if (error) {
        alert('Error selling fish');
        return;
    }
    
    // Update user money
    await supabase
        .from('users')
        .update({ 
            money: userData.money + totalValue,
            updated_at: new Date().toISOString()
        })
        .eq('id', userData.id);
    
    // Reload inventory
    await loadInventory();
    showNotification(`Sold ${commonFish.length} fish for 💰${totalValue}!`, 'success');
}

async function equipRod(rodId) {
    // Unequip current rod
    await supabase
        .from('user_rods')
        .update({ equipped: false })
        .eq('user_id', userData.id);
    
    // Equip new rod
    await supabase
        .from('user_rods')
        .update({ equipped: true })
        .eq('user_id', userData.id)
        .eq('rod_id', rodId);
    
    showNotification('Rod equipped!', 'success');
    await loadRods();
}

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Activate button
    event.target.classList.add('active');
}

function showNotification(message, type = 'info') {
    // Simple notification
    alert(message);
}