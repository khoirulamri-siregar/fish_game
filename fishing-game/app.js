// Configuration
const SUPABASE_URL = 'https://zumpzpccycngnlppxznz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bXB6cGNjeWNuZ25scHB4em56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTU0NDMsImV4cCI6MjA4MDMzMTQ0M30.5RnFCJuWWST-VhJxOwErCkqE3MUAZtfBxuPZSiervlA';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let currentUser = null;
let userData = null;
let currentRod = null;
let currentBait = null;

// DOM Elements
const userInfoEl = document.getElementById('userInfo');
const moneyEl = document.getElementById('money');
const xpEl = document.getElementById('xp');
const levelEl = document.getElementById('level');
const totalFishEl = document.getElementById('totalFish');
const currentRodEl = document.getElementById('currentRod');
const currentBaitEl = document.getElementById('currentBait');

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadUserData();
    await loadEquipment();
    setupEventListeners();
});

// Auth Functions
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        // Create anonymous user
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
            showNotification('Error logging in: ' + error.message, 'error');
            return;
        }
        currentUser = data.user;
        await createUserProfile();
    } else {
        currentUser = session.user;
    }
    
    updateUserInfo();
}

async function createUserProfile() {
    const { error } = await supabase
        .from('users')
        .insert({
            auth_uid: currentUser.id,
            display_name: `Fisher #${Math.random().toString(36).substr(2, 6)}`,
            money: 500,
            xp: 0,
            level: 1,
            total_fishes: 0,
            inventory_slots: 20
        });
    
    if (error && error.code !== '23505') { // Ignore duplicate user error
        console.error('Error creating profile:', error);
    }
}

// Data Loading
async function loadUserData() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', currentUser.id)
        .single();
    
    if (error) {
        console.error('Error loading user data:', error);
        return;
    }
    
    userData = data;
    updateStats();
}

async function loadEquipment() {
    // Load equipped rod
    const { data: rodData } = await supabase
        .from('user_rods')
        .select('rod_id')
        .eq('user_id', userData.id)
        .eq('equipped', true)
        .maybeSingle();
    
    if (rodData) {
        const { data: rodInfo } = await supabase
            .from('rods_catalog')
            .select('*')
            .eq('id', rodData.rod_id)
            .single();
        currentRod = rodInfo;
        currentRodEl.textContent = rodInfo.name;
    } else {
        // Equip basic rod by default
        await supabase
            .from('user_rods')
            .insert({
                user_id: userData.id,
                rod_id: 'basic',
                equipped: true
            });
        const { data } = await supabase
            .from('rods_catalog')
            .select('*')
            .eq('id', 'basic')
            .single();
        currentRod = data;
        currentRodEl.textContent = 'Basic Rod';
    }
    
    // Load bait
    const { data: baitData } = await supabase
        .from('user_baits')
        .select('bait_id, quantity')
        .eq('user_id', userData.id)
        .maybeSingle();
    
    if (baitData) {
        const { data: baitInfo } = await supabase
            .from('baits_catalog')
            .select('*')
            .eq('id', baitData.bait_id)
            .single();
        currentBait = { ...baitInfo, quantity: baitData.quantity };
        currentBaitEl.textContent = `${baitInfo.name} x${baitData.quantity}`;
    } else {
        // Add basic bait by default
        await supabase
            .from('user_baits')
            .insert({
                user_id: userData.id,
                bait_id: 'basic_bait',
                quantity: 10
            });
        const { data } = await supabase
            .from('baits_catalog')
            .select('*')
            .eq('id', 'basic_bait')
            .single();
        currentBait = { ...data, quantity: 10 };
        currentBaitEl.textContent = 'Basic Bait x10';
    }
}

// Fishing Functions
async function startFishing() {
    if (!currentBait || currentBait.quantity < 1) {
        showNotification('⚠️ Tidak ada umpan! Beli di Shop', 'warning');
        return;
    }
    
    // Show fishing screen
    document.querySelector('.welcome-screen').classList.add('hidden');
    document.getElementById('fishingScreen').classList.remove('hidden');
    
    // Start countdown
    let count = 3;
    const countdownEl = document.getElementById('countdown');
    
    const countdown = setInterval(() => {
        count--;
        countdownEl.textContent = count;
        
        if (count <= 0) {
            clearInterval(countdown);
            finishFishing();
        }
    }, 1000);
    
    // Store countdown ID for cancellation
    window.currentCountdown = countdown;
}

function cancelFishing() {
    if (window.currentCountdown) {
        clearInterval(window.currentCountdown);
    }
    document.getElementById('fishingScreen').classList.add('hidden');
    document.querySelector('.welcome-screen').classList.remove('hidden');
}

async function finishFishing() {
    // Consume bait
    await supabase
        .from('user_baits')
        .update({ quantity: currentBait.quantity - 1 })
        .eq('user_id', userData.id)
        .eq('bait_id', currentBait.id);
    
    currentBait.quantity--;
    currentBaitEl.textContent = `${currentBait.name} x${currentBait.quantity}`;
    
    // Call fishing API
    try {
        const response = await fetch('/api/mancing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`
            },
            body: JSON.stringify({
                user_id: userData.id,
                rod_id: currentRod.id,
                bait_id: currentBait.id
            })
        });
        
        if (!response.ok) throw new Error('Fishing failed');
        
        const result = await response.json();
        
        // Show results
        document.getElementById('fishingScreen').classList.add('hidden');
        showResults(result);
        
        // Update user data
        await loadUserData();
        
    } catch (error) {
        console.error('Fishing error:', error);
        showNotification('🎣 Gagal mancing! Coba lagi', 'error');
        document.getElementById('fishingScreen').classList.add('hidden');
        document.querySelector('.welcome-screen').classList.remove('hidden');
    }
}

function showResults(result) {
    const resultsScreen = document.getElementById('resultsScreen');
    const resultsContainer = document.getElementById('catchResults');
    
    resultsContainer.innerHTML = '';
    
    if (result.fishes && result.fishes.length > 0) {
        result.fishes.forEach(fish => {
            const fishCard = document.createElement('div');
            fishCard.className = `fish-card ${fish.rarity}`;
            fishCard.innerHTML = `
                <span class="emoji">${fish.emoji}</span>
                <h4>${fish.name}</h4>
                <p>Weight: ${fish.weight.toFixed(2)}kg</p>
                <p>Value: 💰${fish.value}</p>
                <p class="rarity-${fish.rarity}">${fish.rarity.toUpperCase()}</p>
            `;
            resultsContainer.appendChild(fishCard);
        });
        
        showNotification(`🎉 Tangkap ${result.fishes.length} ikan! +💰${result.total_value}`, 'success');
    } else {
        resultsContainer.innerHTML = '<p>Tidak ada ikan yang tertangkap 😢</p>';
    }
    
    resultsScreen.classList.remove('hidden');
}

function closeResults() {
    document.getElementById('resultsScreen').classList.add('hidden');
    document.querySelector('.welcome-screen').classList.remove('hidden');
}

// Navigation
function navigateTo(page) {
    switch(page) {
        case 'inventory':
            window.location.href = '/inventory.html';
            break;
        case 'shop':
            window.location.href = '/shop.html';
            break;
        case 'leaderboard':
            window.location.href = '/leaderboard.html';
            break;
        case 'profile':
            window.location.href = '/profile.html';
            break;
        case 'home':
        default:
            window.location.href = '/index.html';
    }
}

// Helper Functions
function updateUserInfo() {
    if (userData) {
        userInfoEl.innerHTML = `
            👤 ${userData.display_name} 
            <span class="level-badge">Lv.${userData.level}</span>
        `;
    }
}

function updateStats() {
    if (userData) {
        moneyEl.textContent = userData.money;
        xpEl.textContent = userData.xp;
        levelEl.textContent = userData.level;
        totalFishEl.textContent = userData.total_fishes;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    
    text.textContent = message;
    notification.classList.remove('hidden');
    
    // Set color based on type
    notification.style.background = type === 'error' ? '#FF4444' : 
                                  type === 'warning' ? '#FFAA00' : 
                                  type === 'success' ? '#00C851' : 
                                  'rgba(0, 166, 251, 0.95)';
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function setupEventListeners() {
    // Add any additional event listeners here
}

// Export for use in other pages
window.supabaseClient = supabase;
window.currentUserData = () => userData;
window.showNotification = showNotification;
window.navigateTo = navigateTo;