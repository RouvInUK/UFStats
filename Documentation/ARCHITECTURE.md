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
- **`App.jsx`**: The main controller and router. Handles view switching (`dashboard`, `analytics`, `roster`, `lineup`, etc.), lazy-loads compliance layouts, and handles top-level modals (e.g., Session Terminated).
- **`SyncEngine.js`**: The offline synchronization engine. Intercepts database writes, stores them locally, and processes the queue exponentially when the network allows.
- **`supabaseClient.js`**: Centralized Supabase client initialization and API wrapper functions.
- **`constants/legal.ts`**: Static verified compliance constants (Full Company Name, CRN, Registered Office, Support Email) as required by the UK Companies Act 2006.

### `src/contexts/`
- **`AuthContext.jsx`**: 
  - Manages Supabase session state.
  - Implements the custom **Single-Session Enforcement**: Since native single-session limits are locked behind Supabase Pro, this context generates a unique `local_session_id`, stores it in the `profiles` table upon login, and polls the database every 30 seconds. If a new device logs in, the ID is overwritten, and the older device kicks itself out.

### `src/components/`
- **`Dashboard.jsx`**: The primary live-tracking UI. Handles player selection, action recording, and Voice Tracking integration via the Web Speech API.
- **`Analytics.jsx`**: The Free-tier analytics engine. Computes basic stats (Goals, Assists, Pass %, Defence).
- **`CoachDashboard.jsx`**: The Pro-tier advanced analytics engine. Includes line charts, scatter plots, active player filters, and PDF export functionality.
- **`RosterSetup.jsx` & `LineupManager.jsx`**: Interfaces for configuring the team roster and the active 7 players on the pitch.
- **`StandardFooter.jsx`**: Global compliance footer implementing corporate disclosures, support links, and the haptic/visual **Beach Mode** accessibility high-contrast toggle.
- **`legal/`**: Folder containing lazy-loaded legal modules (`PrivacyPolicy.jsx`, `TermsOfService.jsx`, `AiDisclosure.jsx`, and `LegalLayout.jsx`) using Vite code splitting to isolate heavy text assets from the core stats-tracking code.

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

---

## Compliance & Accessibility Architecture

1. **Vite Code Splitting for SEO & Performance**: Standard legal policies are text-heavy. To avoid bloating the critical stats-tracking bundle, `App.jsx` employs dynamic imports (`React.lazy`) for the legal layout and documents. Vite bundles these as standalone JS chunks, which are only requested when a user visits `/legal/*`, whilst remaining fully indexable by search engine bots.
2. **Beach Mode (High-Contrast Accessibility)**: Conforming to WCAG 2.2 AA and the UK Equality Act 2010, the app implements a system-wide high-contrast toggle. When activated, a `.beach-mode` utility class is applied to the document root, causing style overrides in `index.css` to dynamically map dark colors into extreme high-contrast (pure black background, pure white and yellow text). This completely eliminates glare on direct sunlight beaches and supports impaired vision.
3. **AI Transparency Pipeline**: Guided by the DMCC 2025/2026 and latest ICO directives, the automated LLM coaching advice dashboard clearly displays the automated, non-human tactical status using dedicated "AI-Generated Tactical Briefing" banners to prevent user deception.
4. **Dynamic Theme & Branding Color System (Premium Navy & Teal)**: 
   To support standard Light and Dark themes alongside the new premium Navy-Teal branding without bloating components with redundant conditional logic, the system utilizes a dynamic variable injection pipeline:
   - **Tailwind Palette Overriding**: `tailwind.config.js` extends standard `slate` (neutrals) and `indigo` (brand accent/action colors) classes, routing them directly through dynamic CSS variables (e.g. `var(--color-slate-900)`).
   - **CSS Theme Layers**: `:root` in `src/index.css` maps default dark charcoal grey neutrals (`#111827`/`#030712`) and branding colors (Deep Midnight Navy `#0C2B54` and Sport-Tech Teal `#17B890`).
   - **Light Mode Inversion**: When `html.light-mode` is active, colors automatically map to light neutrals (`#ffffff`/`#f3f4f6`) and swap accent colors for high contrast, seamlessly inverting every pre-existing Tailwind utility class.
   - **Persistence & Anti-Flicker**: Selected settings are persisted in `localStorage` under `ufstats_theme`, resolved in the head of `App.jsx` during boot to prevent visual theme flickering. Smooth theme transitions are applied globally.
