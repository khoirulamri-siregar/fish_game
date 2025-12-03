# 🎣 Pixel Fishing Game

A pixel-art fishing game built with vanilla HTML/CSS/JS, Supabase backend, and Vercel serverless functions.

## Features
- 🎣 Real-time fishing with countdown animation
- 🐟 50 unique fish with different rarities
- 🎣 Rod and bait system with upgrades
- 🧰 Inventory management
- 🏬 Shop for buying equipment
- 🏆 Leaderboard
- ⚙️ Admin panel for managing the game
- 🔐 Supabase authentication

## Setup Instructions

### 1. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL from `seed.sql` in the SQL editor
3. Get your project URL and keys from Settings → API

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=your-secure-password
