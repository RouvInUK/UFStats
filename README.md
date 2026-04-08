# Ultimate Frisbee Stats Tracker

A beautifully designed, mobile-first web application built for Ultimate Frisbee teams to track real-time game statistics from the sideline. Built with React and Vite, powered by Supabase (PostgreSQL), and deployed on Vercel.

## 🚀 Features

- **Mobile-Optimized Dashboard**: A perfectly balanced 3x2 grid of action buttons for fast, muscle-memory data entry on mobile screens without having to re-adjust your grip.
- **Auto-Assist Analytics Engine**: Automatically tracks explicit sequences to reduce data entry complexity. A `Pass` that instantly precedes a `Point` is automatically compiled as both a completed pass and an `Assist`. 
- **Automated Callahans**: A defensive interception (`Defence`) immediately followed by a `Point` assigns a block and a goal natively, without requiring a bespoke Callahan button on the dashboard.
- **Granular Turnover Tracking**: Detailed error tracking separating `Throwaway`, `Drop`, and `Stall Out` to pinpoint offensive breakdowns.
- **Roster & Lineup Manager**: Add/remove players to your master roster, and easily select an active 7-person lineup before stepping on the pitch.
- **Multi-Device Game Sync**: Multiple devices can view and log stats to the same "Active Game" connection. The app automatically fetches the latest Point number so the scoreboard stays perfectly in sync across phones.

## 🛠 Tech Stack Overview
- **Frontend**: React (Vite) + Tailwind CSS (Dynamic glassmorphism aesthetics)
- **Backend / Database**: Supabase (PostgreSQL) 
- **BI / Visualizations**: Metabase (Connects natively to the Supabase Postgres IPv4 Pooler on Port `6543`)
- **Hosting**: Vercel

## 📱 UI Layout

### The Dashboard
Logs actions for the currently selected active player on the pitch.
- **Row 1**: Point (Goal), Pass
- **Row 2**: Throwaway, Drop
- **Row 3**: Stall Out, Defence

### Sub-Menus
- **📊 Stats (Analytics)**: Computes completion percentages, goals, assists, and deep turnover breakdowns. Allows filtering by specific complete/active games.
- **Lineup**: Select your active 7 players for the current point.
- **Roster**: Add new players to your team or deactivate inactive ones.

## 💻 Getting Started Locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
   *Note: Ensure your `stats` and `players` tables are properly configured in your Supabase project.*

3. **Start the local Dev Server**
   ```bash
   npm run dev
   ```

## 📈 Metabase Integration
By connecting an instance of Metabase to the Supabase connection pooler, you can generate visual dashboards (Pie Charts, Bar Graphs) mapped directly to your raw data without writing custom frontend charting logic.

- Database Type: `PostgreSQL`
- Host: Use your Supabase IPv4 Pooler URL (e.g., `aws-0-...pooler.supabase.com`)
- Port: `6543` 
