# uStats Pro - System Architecture

uStats Pro is a modern, offline-capable Single Page Application (SPA) designed to track Ultimate Frisbee statistics in real-time, even in environments with poor network connectivity. 

## Technology Stack
- **Frontend Framework**: React 18, built with Vite for rapid HMR and optimized bundling.
- **Styling**: Tailwind CSS for utility-first, responsive, and highly customizable UI components.
- **Backend & Database**: Supabase (PostgreSQL). Handles data persistence, authentication, and Row Level Security (RLS).
- **Icons**: Lucide React.
- **Charts**: Recharts (for Pro Analytics).
- **PDF Generation**: html2pdf.js.

## Core Architecture Principles
1. **Offline-First Resilience**: Ultimate Frisbee is played on pitches often lacking reliable Wi-Fi. The app uses a custom `SyncEngine` to persistently queue statistical events in `localStorage` and background-sync them to Supabase once connectivity is restored.
2. **State Management**: Context API (`AuthContext`) manages global authentication, user profiles, and tier configurations (Free vs Pro). Component-level state manages the rapidly changing match data to avoid global re-render bottlenecks.
3. **Data Model**: Event-sourced tracking. Every action (Pass, Drop, Goal) is recorded as a discrete row in the `stats` table. Analytics are derived by aggregating these discrete events in real-time.

---

## Directory Structure & Key Modules

### `src/`
The core source code of the application.

- **`main.jsx`**: The React entry point. Wraps the app in an `ErrorBoundary` and the `AuthProvider`.
- **`App.jsx`**: The main controller and router. Handles view switching (`dashboard`, `analytics`, `roster`, `lineup`, etc.) and top-level modals (e.g., Session Terminated).
- **`SyncEngine.js`**: The offline synchronization engine. Intercepts database writes, stores them locally, and processes the queue exponentially when the network allows.
- **`supabaseClient.js`**: Centralized Supabase client initialization and API wrapper functions.

### `src/contexts/`
- **`AuthContext.jsx`**: 
  - Manages Supabase session state.
  - Implements the custom **Single-Session Enforcement**: Since native single-session limits are locked behind Supabase Pro, this context generates a unique `local_session_id`, stores it in the `profiles` table upon login, and polls the database every 30 seconds. If a new device logs in, the ID is overwritten, and the older device kicks itself out.

### `src/components/`
- **`Dashboard.jsx`**: The primary live-tracking UI. Handles player selection, action recording, and Voice Tracking integration via the Web Speech API.
- **`Analytics.jsx`**: The Free-tier analytics engine. Computes basic stats (Goals, Assists, Pass %, Defence).
- **`CoachDashboard.jsx`**: The Pro-tier advanced analytics engine. Includes line charts, scatter plots, active player filters, and PDF export functionality.
- **`RosterSetup.jsx` & `LineupManager.jsx`**: Interfaces for configuring the team roster and the active 7 players on the pitch.

---

## Database Schema (Supabase)

### `profiles`
Stores user-specific metadata and authorization tiers.
- `id` (UUID): Matches Supabase Auth user ID.
- `tier` (Text): 'free', 'pro', or 'coach'.
- `is_system_admin` (Boolean): For administrative overrides.
- `current_session_id` (UUID): Used for the custom anti-account-sharing architecture.

### `teams` & `clubs`
Hierarchical organization of teams. A user can create a club and multiple teams within it.

### `team_players`
Maps players to specific teams with attributes like `name`, `shirt_number`, and `gender_match`.

### `stats`
The immutable ledger of game events.
- `game_name` (Text): The identifier for the match.
- `point_number` (Int): The current point of the match.
- `player` (Text): The player who performed the action.
- `stat_type` (Text): The action (e.g., 'Pass', 'Drop', 'Point', 'Defence').
- `details` (JSONB): Extended metadata (e.g., `{ isCallahan: true }`, `{ x: 10, y: 20 }`).

---

## Security & Authorization
- **Row Level Security (RLS)**: PostgreSQL RLS policies ensure that users can only read, update, and delete data associated with their own `auth.uid()`.
- **Tier Gating**: The frontend checks the `tier` property on the `profile` object to conditionally render the Coach Dashboard or enable Voice Tracking.
- **Session Termination**: Enforced via the 30-second `AuthContext` database heartbeat.

## Voice Tracking Pipeline
1. `Dashboard.jsx` initializes `webkitSpeechRecognition`.
2. Speech is continuously transcribed and checked against an `expectedCommands` array (which contains variations of current player names and actions).
3. Fuzzy matching and phonetic fallbacks (`soundex`) resolve minor mispronunciations (e.g., "cop" -> "drop").
4. Recognized commands trigger the same local state updates as manual button presses.
