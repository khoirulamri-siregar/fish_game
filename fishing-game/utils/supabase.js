import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client
let supabaseClient = null;

export function getSupabaseClient() {
    if (!supabaseClient) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.NODE_ENV === 'development' 
            ? process.env.SUPABASE_ANON_KEY 
            : process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase credentials');
        }
        
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false
            }
        });
    }
    
    return supabaseClient;
}

// Helper functions
export async function getUserById(userId) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) throw error;
    return data;
}

export async function isUserAdmin(userId) {
    try {
        const user = await getUserById(userId);
        return user.is_admin === true;
    } catch (error) {
        return false;
    }
}

export async function updateUserStats(userId, updates) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from('users')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    
    if (error) throw error;
}

export async function getFishCatalog() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('fish_catalog')
        .select('*')
        .order('rarity', { ascending: true });
    
    if (error) throw error;
    return data;
}