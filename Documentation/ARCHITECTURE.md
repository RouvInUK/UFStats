# ustats.pro - System Architecture

ustats.pro is a modern, offline-capable Single Page Application (SPA) designed to track Ultimate Frisbee statistics in real-time, even in environments with poor network connectivity. 

## Technology Stack
- **Frontend Framework**: React 19, built with Vite for rapid HMR and optimized bundling.
- **Styling**: Tailwind CSS for utility-first, responsive, and highly customizable UI components.
- **Backend & Database**: Supabase (PostgreSQL). Handles data persistence, authentication, and Row Level Security (RLS).
- **Payments Integration**: PayPal JavaScript SDK (vault subscriptions) & secure Edge Webhooks (Deno/TypeScript).
- **Icons**: Lucide React.
- **Charts**: Recharts (for Pro Analytics).
- **PDF Generation**: html2pdf.js.
- **AI Sports Journalism**: Node.js serverless route on Vercel (`api/generate-recap.js`) leveraging Google Gemini API with a model cascade fallback.

## Core Architecture Principles
1. **Offline-First Resilience**: Ultimate Frisbee is played on pitches often lacking reliable Wi-Fi. The app uses a custom `SyncEngine` to persistently queue statistical events in `localStorage` and background-sync them to Supabase once connectivity is restored.
2. **State Management**: Context API (`AuthContext`) manages global authentication, user profiles, and tier configurations (Free vs Pro). Component-level state manages the rapidly changing match data to avoid global re-render bottlenecks.
3. **Data Model**: Event-sourced tracking. Every action (Pass, Drop, Goal) is recorded as a discrete row in the `stats` table. Analytics are derived by aggregating these discrete events in real-time.
4. **Passwordless Sideline Telemetry**: To enable sideline volunteer scorers to log game events without creating user accounts, the system provisions unique, 6-digit alphanumeric Pitch Codes (e.g. `P1-A4B`). These pitch codes authorize public writes/updates/deletes dynamically through Supabase Row Level Security (RLS) without exposing high-privilege credentials.
5. **Turnover-Driven Scoring Pipeline**: Displays a balanced, dual-team neutral scoring console that automatically swaps active recording panels to the opposite team upon an offensive turnover or defensive block event. Includes single-touch Undo state rollbacks to preserve telemetry integrity.
6. **Roster Match Validation Safeguards**: To prevent accidental tracking of mismatched lineups during competitive official matches, the pre-game match tracking console (`LineupSelector.jsx`) enforces strict active player validation rules. Selection interfaces restrict activating more than the expected format capacity (5 for Beach/Indoor, 7 for Grass) and block starting any point unless the exact roster quota is active on the pitch.

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
- **`CoachDashboard.jsx`**: The Pro-tier advanced analytics engine. Includes line charts, scatter plots, active player filters, and PDF export functionality. **Now features the Team & Line-Level Stats Suite, which dynamically attributes point stats to line templates using a majority lineup matching threshold, aggregating Clean O-Holds, Break Conversions, Huck Efficiency, and Pass Completion Rates without database overhead.**
- **`RosterSetup.jsx` & `LineupManager.jsx`**: Interfaces for configuring the team roster and the active 7 players on the pitch. Now extended to support Male Matching Player (MMP) and Female Matching Player (FMP) selections for mixed division compliance.
- **`StandardFooter.jsx`**: Global compliance footer implementing corporate disclosures, support links, and the haptic/visual **Beach Mode** accessibility high-contrast toggle.
- **`PayPalUpgradeModal.jsx`**: A premium glassmorphic checkout UI dynamically loading the PayPal Subscriptions SDK, managing UK pricing (£5/mo and £50/yr plans), and celebrating success with elegant celebratory layouts.
- **`TournamentSetupScreen.jsx` [NEW]**: Organizer portal to schedule matches, assign pitches, generate Pitch Codes, and import rosters via drag-and-drop CSV files (mapping player shirt numbers and MMP/FMP gender designations).
- **`VolunteerScorerLogin.jsx` [NEW]**: Segmented 6-digit character entry panel providing passwordless, single-use access for field volunteer scorers.
- **`TournamentScorer.jsx` [NEW]**: Dual-team neutral scorer console implementing turnover-driven focus toggles, lineup ratio audits (Standard Mixed rule alternations vs Light Mixed guidelines), and single-touch Undo state rollbacks.
- **`TournamentMatchSelector.jsx` [NEW]**: Multi-pitch spectator dashboard showing live schedules, statuses, and scoreboards.
- **`AiRecapModule.jsx` [NEW]**: Magazine-style match center tab querying the serverless Gemini API to write objective, compelling sports recap articles with client-side localStorage caching.
- **`TrainingSetupScreen.jsx` [NEW]**: Setup interface for custom and default training drills, player rotation lines, scrimmage matches, and collapsible date-grouped recorded session history logs.
- **`TrainingScorer.jsx` [NEW]**: Real-time stats logging console for practice drills (rep-by-rep or continuous) and dual-team scrimmage matches (Light vs Dark jerseys side-by-side) with local state serialization and resumption controls.
- **`DrillStateContext.jsx` [NEW]**: Context provider managing active session states, selected practice drills, and lineup rosters for Trainings Desk.
- **`legal/`**: Folder containing lazy-loaded legal modules (`PrivacyPolicy.jsx`, `TermsOfService.jsx`, `AiDisclosure.jsx`, and `LegalLayout.jsx`) using Vite code splitting to isolate heavy text assets from the core stats-tracking code. PrivacyPolicy.jsx now includes Section 7 detailing UK GDPR tournament disclosures.
- **`utils/DuaaExportUtility.js` [NEW]**: Unified telemetry, timeline, and roster stats compiler exporting multi-table CSV reports.

---

## Database Schema (Supabase)

### `profiles`
Stores user-specific metadata and authorization tiers.
- `id` (UUID): Matches Supabase Auth user ID.
- `tier` (Text): 'FREE' or 'PRO'.
- `is_system_admin` (Boolean): For administrative overrides.
- `current_session_id` (UUID): Used for the custom anti-account-sharing architecture.
- `paypal_subscription_id` (Text, Unique): Matches PayPal active recurring subscriptions.
- `subscription_status` (Text): e.g. 'active', 'cancelled', 'suspended'.
- `subscription_period` (Text): 'monthly' or 'yearly'.
- `pro_expires_at` (Timestamp with Time Zone): Expiration date for time-limited active promotions or the initial 7-day free trial.
- `created_at` (Timestamp with Time Zone): The timestamp when the profile was generated, used for trial timeline calculations.

### `teams` & `clubs`
Hierarchical organization of teams. A user can create a club and multiple teams within it. The `teams` table includes a `managed_lines` JSONB column which stores user-defined lines (Line Name, array of Player IDs) for advanced line-level statistics comparison.

### `team_players`
Maps players to specific teams with attributes like `name`, `shirt_number`, and `gender_match`.

### `players`
Altered with a nullable `gender_designation` (`mmp`/`fmp`) column to support real-time mixed division ratio monitors while preserving backwards-compatibility for legacy teams.

### `tournaments` [NEW]
Core tournament entity: name, start_date, end_date, created_by.

### `tournament_teams` [NEW]
Teams registered under tournaments: team_name, division.

### `tournament_matches` [NEW]
Match scheduled on pitches: home/away team IDs, score, pitch_number, start_time, status.

### `tournament_scorer_seats` [NEW]
Maps matches to active unique `pitch_code` keys.

### `drill_definitions` [NEW]
Stores team-specific custom and default practice drill definitions.
- `id` (UUID): Primary key.
- `team_id` (UUID): Reference to the owner team.
- `name` (Text): Drill name.
- `category` (Text): e.g. 'Throwing', 'Cutting', 'Defense'.
- `metrics` (Array of Text): Custom actions serialized with action mappings (e.g. `"Butterfingers::Drop"`).
- `flow_type` (Text): 'rep_based' or 'continuous'.
- `created_by` (UUID): Author profile ID.

### `stats`
The immutable ledger of game events.
- `game_name` (Text): The identifier for the match or training session (e.g. `tournament_match_${matchId}`, `Drill: ${drillName}::${date}`, `Scrimmage: ${name}::${date}`).
- `point_number` (Int): The current point of the match or practice repetition.
- `player` (Text): The player who performed the action.
- `stat_type` (Text): The action (e.g., 'Pass', 'Drop', 'Point', 'Defence').
- `details` (JSONB): Extended metadata (e.g., `{ isCallahan: true }`, `{ x: 10, y: 20 }`, `{ pitch_code: "P1-A4B" }`).

---

## Payment, Trial, & Admin Promo Architecture

To support premium membership tiers (£5/mo and £50/yr) securely and flexibly, the system utilizes a **triple-check access pipeline** combining automated PayPal recurring billing, manual administrative promotional grants, and an automated 7-day free trial:

1. **Dual Activation Logic**:
   A profile has Pro access unlocked dynamically if *either* perpetual tier status is `'PRO'`, OR they have a valid, unexpired trial/promotion:
   $$\text{Is Pro} = (\text{tier} = \text{'PRO'}) \lor (\text{pro\_expires\_at} \neq \text{null} \land \text{pro\_expires\_at} > \text{NOW()})$$
   This decouples recurring billing state from direct promotional override capability, preventing user lockout on plan updates.

2. **7-Day Free Coach Pro Trial (New Signups)**:
   - On signup, the database trigger `public.handle_new_user()` automatically sets `pro_expires_at` to `NOW() + INTERVAL '7 days'`.
   - This unlocks full Coach Pro capability immediately for the first week of usage.
   - The application header displays `PRO TRIAL` if the user's `pro_expires_at` is active and is within 8 days of their `created_at` timestamp.
   - The settings modal dynamically checks this difference to output "Free Trial Active until [date]" instead of "Promo Active".

3. **Secure Webhook Verification**:
   - **Client Checkout**: Loads the PayPal JS SDK with `vault=true` and `intent=subscription` in GBP. On checkout approval, we pass the user's ID as `custom_id` to PayPal.
   - **Server Webhook Verification**: Set up a Supabase Edge Function (`paypal-webhook`) listening for events from PayPal.
   - **Cryptographic Signature Verification**: To prevent fraud, the Edge Function makes a secure callback POST to PayPal (`/v1/notifications/verify-webhook-signature`) transmitting raw headers (`paypal-transmission-sig`, `paypal-cert-url`, etc.) letting PayPal's API securely verify event authenticity before any DB changes are applied.
   - **Automated Upgrades/Downgrades**:
     - `BILLING.SUBSCRIPTION.ACTIVATED` / `BILLING.SUBSCRIPTION.RENEWED`: set profile `tier = 'PRO'`, update subscription Period and ID.
     - `BILLING.SUBSCRIPTION.CANCELLED` / `BILLING.SUBSCRIPTION.EXPIRED` / `BILLING.SUBSCRIPTION.PAYMENT.FAILED`: demote profile `tier = 'FREE'`.

4. **Admin Promo Expiration Manager**:
   - Built directly into the **Admin Panel** (`AdminDashboard.jsx`), this interface enables global administrators to grant time-limited trials (+1 week, +1 month, +6 months) or custom calendar expiration dates.
   - Saves `pro_expires_at` via `updateUserProExpiration` in `supabaseClient.js`, with the client calculating real-time visual countdown badges (e.g. *"Promo: 12 days left"*).

---

## Team & Line-Level Stats Architecture

To support granular team and unit (Line) diagnostics for the Coach Pro tier without introducing database schema complexity or migration overhead, the system leverages an **event-sourced frontend aggregation pipeline**:

1. **Predefined Line Templates**: Coaches define strategic lineups (e.g., "O-Line Standard", "D-Line Standard") in the team settings. These are stored as a JSONB array (`managed_lines`) in the `teams` table, consisting of named units and their member player IDs.
2. **Dynamic Lineup Resolution (Threshold Matching)**: During active game tracking, the recorder logs player entries on a point via `Lineup` events. Within the dashboard's analytics `useMemo` block, the system computes the active players for each point. It then runs a **70% Majority Threshold Matcher** to attribute the point to a predefined line template:
   * *Beach (5v5)*: attributes the point if $\ge 4$ players on the field belong to the line.
   * *Grass (7v7)*: attributes the point if $\ge 5$ players on the field belong to the line.
   * Points not crossing this threshold are safely aggregated under a fallback **"Mixed / Custom Lineup"** category.
3. **Advanced Performance Indicators**:
   * **Clean O-Holds**: Points started on Offense (`Start Offense` or receiving a pull) that result in a score (`Point`) with exactly $0$ turnovers.
   * **Break Conversions**: Points started on Defense (`Start Defense` or pulling) that result in a score (`Point`), measured specifically against D-points where an opponent turnover occurred (Transition Offense).
   * **Huck Integrity (Deep Throws)**: Success rate of throws marked with `{ is_huck: true }` in their event details.
   * **Volatility Index**: Turnovers per point played, identifying high-risk vs. clinical playstyles.

---

## Trainings & Scrimmage Scorer (Trainings Desk) Architecture

To support coaching development and team practice logistics without polluting official tournament statistics, the system features a dedicated **Trainings Desk** submodule:

1. **Access Gating**: Access is controlled globally through the `beta_trainings_tier` parameter in the `profiles` table. When enabled by a System Administrator, this unlocks access to the setup hub and scorers.
2. **State Serialization & Active Match Resumption**: Due to potential interruptions or sideline switches to check dashboards, the `TrainingScorer.jsx` automatically serializes active scrimmage matches on state changes. This is written to `localStorage` under `ufstats_active_scrimmage_state`. Upon mounting, the setup dashboard prompts the coach to resume their active session or discard it.
3. **Dynamic Metric Mappings for Custom Buttons**: Coaches can build custom drills with arbitrary tracking buttons. To prevent rendering custom metrics as blank fields on standard dashboards, the system uses a mapped action serializer. Metrics are stored as `"Label::Action"` (e.g. `"butterfingers::Drop"`, `"Huck D::Defence"`). The scorer parses this string:
   - Renders the clean visual label `"butterfingers"` on the button.
   - Maps actions under-the-hood to standard stats (`stat_type = 'Drop'`), dynamically linking custom actions into the Coach Dashboard metrics suite.
4. **Drill Games Played & Points Played Accumulation**: To ensure that player participation in drills contributes accurately to their Coach Dashboard performance totals, the Trainings Desk logs a single `Lineup` event containing all players selected in the rotation line under `point_number: 1` upon drill initiation.
5. **Mobile-Responsive Collapsible Tree Lists**: To eliminate double-scroll list traps on mobile pitch interfaces, both the Drill Library and Recorded Sessions lists utilize collapsible containers displaying elements in native inline grids. Historical logs are aggregated and displayed under expandable calendar days.

---

## Security & Authorization
- **Row Level Security (RLS)**: PostgreSQL RLS policies ensure that users can only read, update, and delete data associated with their own `auth.uid()`.
- **Pitch-Code-Authorized Public RLS Rules**: Restructures RLS policies on the `stats` table to permit public INSERT, UPDATE, and DELETE actions strictly when an active alphanumeric code (`pitch_code`) stored in `details->>'pitch_code'` matches a verified seat assignment in `tournament_scorer_seats`, allowing passwordless sideline scorer entry without compromising database isolation.
- **Column-Level Tamper Protection**: Implements a PostgreSQL `BEFORE UPDATE` trigger on the `profiles` table. If a non-admin client tries to modify columns like `tier`, `pro_expires_at`, `beta_voice_pro`, `is_system_admin`, `beta_tournament_tier`, or `beta_trainings_tier` directly from client-side JS, the database intercepts the request and automatically reverts those columns to their previously verified database state, completely neutralizing front-end console injections.
- **Secure Admin User Deletion**: Implements a highly secure `delete_user_by_admin(target_user_id)` database function marked as `SECURITY DEFINER` (running as superuser). The function strictly verifies that the executing caller is a validated global System Administrator in the database before wiping the target record from `auth.users`. Because the schema uses full cascading constraints (`ON DELETE CASCADE`), deleting a user automatically, cleanly, and safely purges all of their profiles, clubs, teams, roster players, and game stats, leaving zero orphan database records.
- **SaaS-Grade Team Deletion Safety**: Completely disables team deletion actions from the primary selection screens to prevent accidental data purging. Team deletion is secured inside the `SettingsModal` under a distinct "Danger Zone" block, requiring the user to explicitly enter `DELETE "[Team Name]"` in a quote-sensitive validation box. The deletion API remains locked and inactive unless the text box matches the exact case-sensitive string.
- **Tier Gating**: The frontend checks the Boolean `isProTier` state computed globally to conditionally render the Coach Dashboard or enable Voice Tracking. Tournament desk access is gated securely by checking `profile?.beta_tournament_tier || profile?.is_system_admin`. Trainings Desk access is similarly gated by checking `profile?.beta_trainings_tier || profile?.is_system_admin`.
- **Session Termination**: Enforced via the 30-second `AuthContext` database heartbeat.

## Voice Tracking Pipeline
1. `Dashboard.jsx` initializes `webkitSpeechRecognition`.
2. Speech is continuously transcribed and checked against an `expectedCommands` array (which contains variations of current player names and actions).
3. Fuzzy matching and phonetic fallbacks (`soundex`) resolve minor mispronunciations (e.g., "cop" -> "drop").
4. Recognized commands trigger the same local state updates as manual button presses.

---

## Compliance & Accessibility Architecture

1. **Vite Code Splitting for SEO & Performance**: Standard legal policies are text-heavy. To avoid bloating the critical stats-tracking bundle, `App.jsx` employs dynamic imports (`React.lazy`) for the legal layout and documents. Vite bundles these as standalone JS chunks, which are only requested when a user visits `/legal/*`, whilst remaining fully indexable by search engine bots.
2. **Beach Mode (High-Contrast Accessibility)**: Conforming to WCAG 2.2 AA and the UK Equality Act 2010, the app implements a system-wide high-contrast toggle. When activated, a `.beach-mode` utility class is applied to the document root, causing style overrides in `index.css` to dynamically map dark colors into extreme high-contrast (pure black background, pure white and yellow text). This completely eliminates glare on direct sunlight beaches and supports impaired vision. **To support on-the-fly contrast adjustments under shifting outdoor glare, direct high-contrast toggles are integrated directly onto the headers of the three active tracking consoles (Lineup Selection, Club Dashboard, and Tournament Scorer screens), dynamically syncing user preferences to local storage.**
3. **AI Transparency Pipeline**: Guided by the DMCC 2025/2026 and latest ICO directives, the automated LLM coaching advice dashboard clearly displays the automated, non-human tactical status using dedicated "AI-Generated Tactical Briefing" banners to prevent user deception.
4. **Dynamic Theme & Branding Color System (Premium Navy & Teal)**: 
   To support standard Light and Dark themes alongside the new premium Navy-Teal branding without bloating components with redundant conditional logic, the system utilizes a dynamic variable injection pipeline:
   - **Tailwind Palette Overriding**: `tailwind.config.js` extends standard `slate` (neutrals) and `indigo` (brand accent/action colors) classes, routing them directly through dynamic CSS variables (e.g. `var(--color-slate-900)`).
   - **CSS Theme Layers**: `:root` in `src/index.css` maps default dark charcoal grey neutrals (`#111827`/`#030712`) and branding colors (Deep Midnight Navy `#0C2B54` and Sport-Tech Teal `#17B890`).
   - **Light Mode Inversion**: When `html.light-mode` is active, colors automatically map to light neutrals (`#ffffff`/`#f3f4f6`) and swap accent colors for high contrast, seamlessly inverting every pre-existing Tailwind utility class.
   - **Persistence & Anti-Flicker**: Selected settings are persisted in `localStorage` under `ufstats_theme`, resolved in the head of `App.jsx` during boot to prevent visual theme flickering. Smooth theme transitions are applied globally.
5. **Themed PWA Manifest & Maskable Launcher Icon Architecture**:
    To deliver a tailored application icon and system theme experience matching the user's color scheme preferences on mobile and desktop platforms, the system implements a dynamic manifest and dual-purpose icon registry:
    - **Real-Time Manifest Switching**: An inline script in the head of `index.html` inspects `localStorage` and `matchMedia('(prefers-color-scheme: dark)')` to dynamically swap the manifest source attribute before layout paint (`/manifest_dark.json` for Dark Mode and `/manifest.json` for Light Mode).
    - **Dual-Purpose PWA Icons**: 
      - **Transparent Standard Icons** (`logo_dark_icon.png` / `logo_light_icon.png`): Configured with `"purpose": "any"` in the manifest to render with high fidelity and transparency on desktop status bars, macOS Docks, and Windows shortcuts.
      - **Solid-Background Maskable Icons** (`logo_dark_maskable.png` / `logo_light_maskable.png`): Configured with `"purpose": "maskable"` in the manifest. These icons include the branding emblem centered inside a 12% safe zone margin on a solid background (`#080c14` for Dark Charcoal, `#FFFFFF` for Light Mode). This prevents Android launchers from painting standard white backup plates when cropping icons to circles/squircles, ensuring a seamless home screen experience.
6. **Favicon and Top-Left Page Headers Branding**:
    To present a clean, sophisticated, and premium look, the browser tab's favicon and the top-left navigation headers of the application dynamically render the **textless** brand logo (just the emblem, without "ustats.pro" text) while the main landing page body retains the full text-based logo:
    - **Fallback Icon Asset**: A dedicated fallback `/logo_icon.png` is placed in the public directory and swapped to `/logo_dark_icon.png` or `/logo_light_icon.png` depending on the active light/dark theme.
    - **Real-Time Favicon Toggling**: An inline pre-paint script in `index.html` resolved in tandem with `App.jsx` and the preferences modal dynamically swaps the `<link>` tags' `href` attribute on the fly.
    - **CSS-Powered Image Swapping**: The dynamic theme injection pipeline is extended in `src/index.css` to target `logo_icon.png` and seamlessly replace its contents via CSS `content: url(...)` overrides based on `html.light-mode` state, preventing layout shifts or React render delays.
