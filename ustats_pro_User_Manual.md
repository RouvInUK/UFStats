# ustats.pro
## User Manual & Getting Started Guide

<div align="center">
  <img src="public/logo.png" width="300" alt="ustats.pro Logo" />
</div>

---

## 1. Introduction
Welcome to ustats.pro! ustats.pro is a specialized, mobile-optimized Progressive Web App (PWA) designed for tracking Ultimate Frisbee games in real-time, directly from the sideline. Built to operate under harsh field conditions (glare, rain, poor network connectivity), it provides deep analytical insights for coaches and team captains.

---

## 2. Getting Started: First Steps

### 2.1 The Club & Team Hierarchy
To keep your data organized across different seasons and divisions, UFStats uses a hierarchical system:
1. **Club:** This is your overarching organization (e.g., "Deep Space Ultimate"). Players are added at the Club level, meaning you only ever have to type a player's name and shirt number once.
2. **Teams:** These sit inside your Club (e.g., "Open Roster 2026", "Mixed Roster", "Development Squad"). You can assign the same Club players to different teams without duplicating their stats.

### 2.2 Setting Up Your Organization
1. **Create a Club:** Upon logging in, you will be prompted to create your first Club.
2. **Create a Team:** Under your new Club, create a specific Team.
3. **Build your Roster:** Navigate to the **Roster** tab. Add your players, their shirt numbers, and their primary roles (Handler, Cutter, Hybrid). Since these are saved to the Club, they will be available for any Team you create inside this Club.
4. **Select a Team:** Click on your Team from the Team Selection screen to enter the main dashboard and begin logging a game!

---

## 3. Core Features & Tracking

### 3.1 The Dashboard (Live Tracker)
The Dashboard is the heart of the app. It is meticulously designed with a "No-Scroll" philosophy so all primary actions fit onto a single phone screen—perfect for fast-paced tracking.
- **Scoreboard:** Pinned to the top, showing the current score, the point number, and whether your team is on Offense (O) or Defense (D).
- **On Pitch:** Displays the active players for the current point. Players with shirt numbers will display them prominently. To attribute an action to a player, simply tap their square.
- **Scoring Actions:** Use the **WE SCORED** (Green) or **THEY SCORED** (Red) buttons to immediately end the point.
- **Game Events:** Log turnovers using **Drop**, **Incomplete**, **Stall Out**, or log a defensive block using **Defence**.

### 3.2 Match Management & Lineup Selector
When starting a new match or after every point, you are taken to the Lineup Selector.
- **Match Setup:** Enter the Match Identifier (e.g., "Pool Play Game 1"), Opponent Name, Game Format (Grass, Beach, Indoor, Training), and Starting Possession.
- **Player Selection:** Tap players from your roster to bring them "On Pitch". 
- **Start Point:** Once your lineup matches the required format size (7 for Grass, 5 for Beach), tap "START POINT" to enter the live dashboard.
- **Mid-Point Subs:** If a player is injured or swaps out mid-point, tap **Sub** in the footer. You can adjust the lineup without starting a new point.
- **Undo Point:** Accidentally scored a point incorrectly? Use the **Undo** button in the Lineup Selector to erase the last point completely and restore the previous state.

### 3.3 The Pull Tracker
If you are starting a point on **Defense**, the app will automatically prompt you to track the Pull.
- **Puller:** Select which player is throwing the pull.
- **Location & Hangtime:** Track how deep the pull landed (e.g., Deep Endzone, Midfield, Out of Bounds) and any specific outcomes (e.g., Dropped Pull, Callahan).
- This data feeds directly into the Coach Dashboard to automatically grade your team's pullers.

---

## 4. Advanced & Pro Features

### 4.1 Offline Sync Engine (Free)
UFStats works flawlessly without an internet connection. 
- You will see a small cloud icon indicating how many points are currently waiting to be synced.
- The app automatically syncs all pending data to the cloud as soon as your device regains cellular or Wi-Fi connectivity.
- A "Synchronizing..." and "✓ Saved..." indicator will appear at the top of the On-Pitch section to confirm that data is safely stored.

### 4.2 Voice Pro Mode (Pro) - [Temporarily Disabled]
*(Note: This feature is currently disabled while we roll out iOS compatibility updates).*
For completely hands-free operation, tap the **Microphone** icon at the bottom of the Dashboard to activate Voice Pro.
- Uses natural language processing to listen to the play-by-play.
- Example: *"John caught it, passed to Sarah, she dropped it."* 
- The system will interpret the chain of events and log them automatically.

### 4.3 Coach Dashboard Analytics (Free & Pro)
The Coach Dashboard is the central hub for reviewing player and team performance across all synced games.
- **Filters:** Filter by specific tournaments, individual games, or specific opponents.
- **Traditional Metrics:**
  - **O-Pts / D-Pts:** The total number of points played starting on Offense vs. Defense.
  - **Touches / Pt:** The average number of times the player touches the disc per point played.
  - **GAD (Goals/Assists/Ds):** The holy trinity of traditional ultimate frisbee stats. Shows total Goals scored, Assists thrown, and Defensive blocks (Ds) generated.
  - **Turnovers (T/D/S):** A breakdown of total turnovers, displaying Throwaways (T), Drops (D), and Stall Outs (S).
  - **Completion %:** The percentage of a player's throws that are successfully caught by a teammate.

- **Advanced System Metrics:** 
  - **System Impact (On-Off +/-):** Calculates the percentage change in the team's overall scoring efficiency when this player is on the pitch compared to when they are on the sideline. It automatically corrects for O/D starting bias, providing a true measure of a player's value to the team's success.
  - **OCE (Offensive Conversion Efficiency):** The team's success rate at converting possessions into goals while this player is active on the pitch. A high OCE means the team rarely turns the disc over with this player on the field.
  - **OVA (Offensive Value Added):** A weighted offensive contribution score that heavily rewards high-value actions. It factors in Assists, Hockey Assists (the throw before the assist), and Clean Holds (points scored without any turnovers).
  - **Pull Impact:** A weighted average score (0.0 - 5.0) grading a player's pull quality. It is calculated automatically based on field position (e.g., Deep Endzone = 5, Out of Bounds = 0) and the resulting pressure on the opponent.
  - **Usage Rate:** Represents the percentage of the team's total touches that go through this player when they are on the pitch. Handlers typically have high usage rates (>20%), while cutters have lower, more efficient usage rates.
  - **NIS (Net Impact Score):** A comprehensive player efficiency rating per point played. It weighs positive actions (Goals, Assists, Ds, Touches) against negative actions (Drops, Throwaways) to provide a single, holistic number indicating the player's overall game impact.
- **Possession Chain Timeline:** Click on any game to see a detailed, chronologically sorted, play-by-play sequence of every single pass and event in the match.

---

## 5. Pricing: Free vs. Coach Pro

UFStats is designed to be accessible to grassroots teams while offering elite tools for professional coaches.

### 🟢 Free Tier
Everything you need to track a team for a season.
- **1 Club** per user.
- **Up to 3 Teams** inside your club.
- Unlimited Games and Stats tracking.
- Full access to the Offline Sync Engine.
- Standard Coach Dashboard analytics.

### 🟣 Coach Pro Tier
Built for club directors, university programs, and power users.
- **Unlimited Clubs.**
- **Unlimited Teams.**
- **Voice Pro:** Hands-free AI voice tracking *(Temporarily Disabled)*.
- Advanced export capabilities and priority support.

---

## 6. Best Practices for Sideline Tracking
1. **Always select the player *first***, then tap the action. (e.g., Tap "Sarah", then tap "Drop").
2. **Possession Chains:** To track passes, simply tap players in the order they catch the disc. (e.g., Tap "John", tap "Sarah", tap "Mike"). The app automatically builds the assist and secondary assist chains based on this sequence.
3. Keep the device in **Portrait Mode** for the best layout experience.
