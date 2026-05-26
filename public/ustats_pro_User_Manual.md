<div align="center">
  <img src="public/logo_light.png" width="240" alt="ustats.pro Logo" />
  <h1 style="font-size: 2.2em; margin-top: 20px;">User Manual & Getting Started Guide</h1>
</div>

---

## 1. Introduction
Welcome to ustats.pro! ustats.pro is a specialized, mobile-optimized Progressive Web App (PWA) designed for tracking Ultimate Frisbee games in real-time, directly from the sideline. Built to operate under harsh field conditions (glare, rain, poor network connectivity), it provides deep analytical insights for coaches and team captains.

---

## 2. Getting Started: First Steps

### 2.1 The Club & Team Hierarchy
To keep your data organized across different seasons and divisions, ustats.pro uses a hierarchical system:
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
ustats.pro works flawlessly without an internet connection. 
- You will see a small cloud icon indicating how many points are currently waiting to be synced.
- The app automatically syncs all pending data to the cloud as soon as your device regains cellular or Wi-Fi connectivity.
- A "Synchronizing..." and "✓ Saved..." indicator will appear at the top of the On-Pitch section to confirm that data is safely stored.

### 4.2 Coach Dashboard Analytics & True Impact Master Roster (Free & Pro)
The Coach Dashboard is the central analytical hub of ustats.pro, compiling sidelined data into rich, actionable insights. Its centerpiece is the **True Impact Master Roster** (Coach Pro Impact Matrix), a sortable analytics table containing 16 key performance indicators. These metrics are divided between traditional volume statistics and advanced efficiency and utility metrics.

#### The 16 Impact Matrix Columns Explained

##### 1. Player (Name & On/Off +/-)
*   **Description:** The player's identity and their raw game-point margin while on the pitch.
*   **Calculation Formula:**
    $$\text{On/Off } \pm = (\text{Points Won by Team while Active}) - (\text{Points Lost by Team while Active})$$
*   **Coaching Rationale:** A simple baseline to track the scoring margin during a player's field time. However, it does not correct for starting line bias (O-line vs. D-line), which is addressed by the *System Impact %* metric.

##### 2. PP (Points Played)
*   **Description:** Total volume of play-time.
*   **Calculation Formula:**
    $$\text{Points Played} = \text{Holds Played} + \text{Breaks Played}$$
*   **Coaching Rationale:** Represents the player's overall workload and sample size of data.

##### 3. Offense/Defense Split
*   **Description:** The split of points where the team started on Offense (receiving the pull) vs. Defense (pulling).
*   **Calculation Formula:**
    $$\text{Offense/Defense Split} = \text{Holds Played} \ \big/ \ \text{Breaks Played}$$
*   **Coaching Rationale:** Essential for identifying player deployment roles (O-Line vs. D-Line specialists).

##### 4. Touches
*   **Description:** Total number of times the player possessed the disc during the games analyzed (excluding pulls thrown).
*   **Calculation Formula:**
    $$\text{Touches} = \text{Total recorded actions for the player} - \text{Pulls}$$
*   **Coaching Rationale:** Measures active involvement and possession volume on offense.

##### 5. Average Touches per Point
*   **Description:** The average offensive workload per point played.
*   **Calculation Formula:**
    $$\text{Touches per Point} = \frac{\text{Touches}}{\text{Points Played}}$$
*   **Coaching Rationale:** Measures how central a player is to the offense when they are on the field. Handlers typically have high Touches/Pt (>3.0), whereas cutters have lower, more efficient numbers.

##### 6. Goals, Assists, Secondary Assists, and Blocks
*   **Description:** The complete box score of direct scoring and defensive actions.
*   **Calculations:**
    *   **Goals**: Incremented when the player catches a pass in the endzone.
    *   **Assists**: Incremented for the player who throws the final completed pass of a scoring point.
    *   **Secondary Assists**: The "hockey assist"—the completed pass immediately preceding the assist. Calculated by tracking the possession chain and identifying the second-to-last thrower in a scoring point.
    *   **Defensive Blocks**: Turnover-inducing blocks, interceptions, or forced errors.
*   **Coaching Rationale:** Direct impact events. The inclusion of *Secondary Assists* ensures that setup handlers who drive the disc downfield get credit for their crucial role in breaking the defense.

##### 7. Turnovers
*   **Description:** Total team possessions lost due to player errors, broken down into specific categories.
*   **Calculation Formula:**
    $$\text{Total Turnovers} = \text{Throwaways} + \text{Drops} + \text{Stalls}$$
    *   **Throwaways**: Errant or incomplete passes.
    *   **Drops**: Dropped catchable passes.
    *   **Stalls**: Stalling out with the disc (10-second count).
*   **Coaching Rationale:** Identifies the precise nature of offensive breakdowns.

##### 8. Passes
*   **Description:** Completed passes vs. Attempted passes.
*   **Calculation Formula:**
    $$\text{Completed Passes} \ \big/ \ \text{Attempted Passes}$$
    *   *Attempted Passes* is calculated as $\text{Completed Passes} + \text{Throwaways} + \text{Receiver Drops}$ (to capture all throws released by the player).
*   **Coaching Rationale:** High attempted numbers signify a high-volume distributor.

##### 9. Pass Completion Percentage
*   **Description:** The safety and accuracy rating of a player's throws.
*   **Calculation Formula:**
    $$\text{Pass Completion Percentage} = \left( \frac{\text{Completed Passes}}{\text{Attempted Passes}} \right) \times 100$$
*   **Coaching Rationale:** Primary handlers should ideally maintain a completion rate above 90% to provide structural stability.

##### 10. Completed Hucks / Attempted Hucks
*   **Description:** High-risk, high-reward huck efficiency tracking.
*   **Calculation Formula:**
    $$\text{Hucks Completed} \ \big/ \ \text{Hucks Attempted}$$
    *   *Huck Attempts* include completed huck passes, huck throwaways, and hucks dropped by the receiver.
*   **Coaching Rationale:** Isolates deep-throwing efficiency from short-passing statistics. Crucial for assessing deep throwers and decision-making on high-yardage shots.

##### 11. System Impact Percentage
*   **Description:** The percentage change in team scoring efficiency when this player is on the pitch compared to when they are on the sideline, automatically adjusting for starting Offense/Defense line bias.
*   **Calculation Formula:**
    For every point played by a player, their impact is calculated against the team's overall tournament average (the baseline):
    *   If the team started the point on **Offense**:
        $$\text{Point Impact} = \text{Point Result} - \text{Global Hold Rate}$$
        *(where Point Result is 1 if the team scored, and 0 if conceded)*
    *   If the team started the point on **Defense**:
        $$\text{Point Impact} = (\text{Point Result} - \text{Global Break Rate}) \times 2.0 \ \text{ (Break Bonus)}$$
        *(where Point Result is 1 if the team scored, and 0 if conceded. The Break Bonus of 2.0 is applied only to positive break impacts)*
    *   $$\text{System Impact Percentage} = \left( \frac{\sum \text{Weighted Impacts}}{\text{Points Played}} \right) \times 100$$
*   **Coaching Rationale:** In Ultimate, scoring on offense (holding) is significantly easier than scoring on defense (breaking). A simple +/- heavily biases O-line players. *System Impact %* corrects for this by grading each point against baseline expectations. Winning a break-point is rewarded with a **double weight bonus (2.0x)**, while holding simply meets standard expectations. This allows coaches to identify players who make a massive structural impact, regardless of which line they start on.

##### 12. Offensive Conversion Efficiency
*   **Description:** The team's success rate at converting possessions into goals while this player is on the pitch.
*   **Calculation Formula:**
    $$\text{Offensive Conversion Efficiency} = \left( \frac{\text{Goals Scored on Pitch}}{\text{Possessions Played}} \right) \times 100$$
    *   *Possessions Played* = Total team turnovers during played points + 1 for each point won.
    *   *Goals Scored on Pitch* = Team goals scored while the player was active.
*   **Coaching Rationale:** Measures how clinical the offense is. A high OCE means the team rarely turns the disc over and efficiently converts opportunities with this player active.

##### 13. OVA (Offensive Value Added)
*   **Description:** A weighted metric highlighting mistake-free offensive production and distribution.
*   **Calculation Formula & Weighting:**
    $$\text{OVA} = (\text{Clean Holds} \times 0.5) + (\text{Assists} \times 2.0) + (\text{Secondary Assists} \times 1.5)$$
    *   *Clean Holds:* Number of O-points won where the team committed **zero** turnovers while the player was active.
*   **Coaching Rationale:** Heavily rewards facilitators (Assists at 2.0x, Secondary Assists at 1.5x) and places a premium on clean, turnover-free possession flow (Clean Holds at 0.5x). High OVA indicates a highly effective, error-free distributor.

##### 14. Pull Impact
*   **Description:** Average score grading the quality and depth of a player's pulls.
*   **Calculation Formula:**
    $$\text{Pull Impact} = \frac{\sum \text{Individual Pull Scores}}{\text{Total Pulls}}$$
    *   *Individual Pull Scores* are graded on a 0.0 to 5.0 scale automatically, where a deep pull pinned in the endzone yields a 5.0, and an out-of-bounds pull yields a 0.0.
*   **Coaching Rationale:** Evaluates defensive field position generation. Excellent pulls allow the D-line maximum time to set up and apply pressure.

##### 15. Usage Rate
*   **Description:** The player's share of team touches while they are on the field.
*   **Calculation Formula:**
    $$\text{Usage Rate} = \left( \frac{\text{Player Touches}}{\text{Total Team Touches on Played Points}} \right) \times 100$$
*   **Coaching Rationale:** Helps coaches manage offensive balance. If a single handler has a usage rate >30%, the offense is highly centralized and vulnerable to shutdown defense.

##### 16. NIS (Net Impact Score)
*   **Description:** A comprehensive, single-number utility metric representing the player's overall efficiency and contribution per point played.
*   **Calculation Formula & Weighting Coefficients:**
    $$\text{Net Impact Score} = \frac{(\text{Goals} \times 2.0) + (\text{Assists} \times 1.5) + (\text{Blocks} \times 2.0) + (\text{Completed Passes} \times 0.3) + (\text{Completed Hucks} \times 0.7) - (\text{Turnovers} \times 2.0) + (\text{Huck Turnovers} \times 0.5)}{\text{Points Played}}$$
    *   **Goals**: Catching a pass in the endzone (Weight: **+2.0**).
    *   **Assists**: Throwing the final completed scoring pass (Weight: **+1.5**).
    *   **Blocks**: Generating a defensive block or interception (Weight: **+2.0**).
    *   **Completed Passes**: Successful distribution throws (Weight: **+0.3**).
    *   **Completed Hucks**: Successful deep throws (Weight: **+0.7** in addition to the +0.3 pass value, totaling **+1.0** per huck).
    *   **Turnovers**: Throwaways, receiver drops, or stall outs (Weight: **-2.0**).
    *   **Huck Turnovers**: Deep turnovers (Weight Adjustment: **+0.5**, resulting in a net penalty of **-1.5** instead of -2.0 due to better opponent starting position).
*   **Coaching Rationale:** Net Impact Score acts as the player efficiency rating (PER) of ustats.pro. By dividing the weighted utility sum by points played, it standardizes performance, allowing fair comparisons across different playtime volumes. Positive actions are rewarded, but turnovers are heavily penalized (-2.0). Notably, a deep turnover (huck turnover) is penalized slightly less (-1.5) because deep throws typically turn over deep in opponent territory, carrying a lower field-position cost than short turnovers.

- **Possession Chain Timeline:** Click on any game to see a detailed, chronologically sorted, play-by-play sequence of every single pass and event in the match.

---

## 5. Pricing: Free vs. Coach Pro

ustats.pro is designed to be accessible to grassroots teams while offering elite tools for professional coaches.

### 🟢 Free Tier
Everything you need to track a team for a season.
- **1 Club** per user.
- **Up to 2 Teams** inside your club.
- Unlimited Games and Stats tracking.
- Full access to the Offline Sync Engine.
- Standard Coach Dashboard analytics.

### 🟣 Coach Pro Tier
Built for club directors, university programs, and power users.
- **1 Club** per user.
- **Up to 5 Teams** inside your club.
- **Advanced Coach's Dashboard & Analytics**: True Impact Net Impact Score (NIS) player metrics, sideline pull quality grading, and dynamic lineup resolution.
- Advanced export capabilities and priority support.

---

## 6. Best Practices for Sideline Tracking
1. **Always select the player *first***, then tap the action. (e.g., Tap "Sarah", then tap "Drop").
2. **Possession Chains:** To track passes, simply tap players in the order they catch the disc. (e.g., Tap "John", tap "Sarah", tap "Mike"). The app automatically builds the assist and secondary assist chains based on this sequence.
3. Keep the device in **Portrait Mode** for the best layout experience.
