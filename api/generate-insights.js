import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the standard Google Generative AI SDK dynamically inside the handler.
export default async function handler(req, res) {
  // 1. Enforce secure CORS and request methods
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const resolvedApiKey = process.env.GEMINI_API_KEY ||
                           process.env.GEmini_API_Key ||
                           process.env.Gemini_API_Key ||
                           process.env.gemini_api_key ||
                           process.env.VITE_GEMINI_KEY;

    if (!resolvedApiKey) {
      console.error("[generate-insights] Missing Gemini API Key environment variable.");
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const genAI = new GoogleGenerativeAI(resolvedApiKey);
    const { playerStats, rawStats, gameType, score, isMultiGame, teamStats } = req.body;

    // Calculate total matches logged dynamically
    const uniqueGames = rawStats && rawStats.length > 0 
      ? Array.from(new Set(rawStats.map(s => s.game_name))).filter(Boolean) 
      : [];
    const totalGamesCount = Math.max(1, uniqueGames.length);

    // 2. Aggregate and truncate data to fit the context
    const cleanPlayerStats = playerStats ? playerStats.map(p => ({
      name: p.name,
      goals: p.goals || 0,
      assists: p.assists || 0,
      secondaryAssists: p.secondaryAssists || 0,
      ds: p.ds !== undefined ? p.ds : (p.blocks || 0),
      turnovers: p.turnovers || 0,
      pointsPlayed: p.pp || p.pointsPlayed || 0,
      gamesPlayed: p.gamesPlayed || 0,
      touchesPerPoint: p.touchesPerPoint || 0,
      passAttempts: p.passAttempts || 0,
      completions: p.passes || 0
    })) : [];

    const cleanRawStats = rawStats ? rawStats.slice(-150).map(s => ({
      player: s.player,
      action: s.stat_type,
      point: s.point_number,
      details: s.details || null
    })) : [];

    // 3. Compute Advanced Telemetry Metrics to Feed the LLM Prompt
    let oPointsPlayed = 0;
    let cleanHolds = 0;
    let dPointsPlayed = 0;
    let breaks = 0;
    let scoringPointsCount = 0;
    let passesInScoringPoints = 0;
    let oHuckAttempts = 0;
    let oHuckCompletions = 0;
    let dHuckAttempts = 0;
    let dHuckCompletions = 0;

    let currentPointPasses = 0;
    let currentPointTurnovers = 0;
    let isDPoint = false;
    let isFirstEvent = true;

    let lastGameName = null;
    if (rawStats && rawStats.length > 0) {
      // Process chronologically (already sorted oldest first)
      const chronologicalStats = rawStats;

      chronologicalStats.forEach(stat => {
        if (lastGameName && stat.game_name !== lastGameName) {
          isDPoint = false;
          isFirstEvent = true;
          currentPointPasses = 0;
          currentPointTurnovers = 0;
        }
        lastGameName = stat.game_name;

        if (stat.stat_type === 'Start Defense') {
          isDPoint = true;
        } else if (stat.stat_type === 'Start Offense') {
          isDPoint = false;
        }

        const realActions = ['Pull', 'Pass', 'Opponent Turnover', 'Throwaway', 'Drop', 'Stall Out', 'Defence', 'Block'];
        if (isFirstEvent && realActions.includes(stat.stat_type)) {
          if (stat.stat_type === 'Pull') {
            isDPoint = true;
          }
          if (isDPoint) dPointsPlayed++;
          else oPointsPlayed++;
          isFirstEvent = false;
        }

        if (stat.details?.is_huck) {
          if (isDPoint) {
            dHuckAttempts++;
            if (['Pass', 'Point'].includes(stat.stat_type)) dHuckCompletions++;
          } else {
            oHuckAttempts++;
            if (['Pass', 'Point'].includes(stat.stat_type)) oHuckCompletions++;
          }
        }

        if (['Pass', 'Point'].includes(stat.stat_type)) {
          currentPointPasses++;
          if (stat.stat_type === 'Point') {
            scoringPointsCount++;
            passesInScoringPoints += currentPointPasses;
            if (isDPoint) breaks++;
            else if (currentPointTurnovers === 0) cleanHolds++;

            currentPointPasses = 0;
            currentPointTurnovers = 0;
            isFirstEvent = true;
            isDPoint = true;
          }
        } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
          currentPointTurnovers++;
        } else if (stat.stat_type === 'Opponent Point') {
          currentPointPasses = 0;
          currentPointTurnovers = 0;
          isFirstEvent = true;
          isDPoint = false;
        }
      });
    }

    const cleanHoldRate = oPointsPlayed > 0 ? (cleanHolds / oPointsPlayed) * 100 : 0;
    const breakRate = dPointsPlayed > 0 ? (breaks / dPointsPlayed) * 100 : 0;
    const passToScoreRatio = scoringPointsCount > 0 ? (passesInScoringPoints / scoringPointsCount) : 0;
    const oHuckIntegrityPct = oHuckAttempts > 0 ? (oHuckCompletions / oHuckAttempts) * 100 : 0;
    const dHuckIntegrityPct = dHuckAttempts > 0 ? (dHuckCompletions / dHuckAttempts) * 100 : 0;

    // Use pre-calculated frontend telemetry if available to guarantee 100% exact alignment
    const cleanHoldRateVal = teamStats && teamStats.cleanHoldRate !== undefined ? teamStats.cleanHoldRate : cleanHoldRate;
    const breakRateVal = teamStats && teamStats.breakRate !== undefined ? teamStats.breakRate : breakRate;
    const oHuckRateVal = teamStats && teamStats.huckSuccessRate !== undefined ? teamStats.huckSuccessRate : oHuckIntegrityPct;
    const dHuckRateVal = teamStats && teamStats.dHuckSuccessRate !== undefined ? teamStats.dHuckSuccessRate : dHuckIntegrityPct;

    const advancedMetricsSummary = {
      cleanHoldRate: `${cleanHoldRateVal.toFixed(0)}%`,
      breakRate: `${breakRateVal.toFixed(0)}%`,
      passToScoreRatio: passToScoreRatio.toFixed(1),
      offensiveHuckIntegrity: `${oHuckRateVal.toFixed(0)}%`,
      defensiveHuckIntegrity: `${dHuckRateVal.toFixed(0)}%`
    };

    if (teamStats && teamStats.completionRate !== undefined) {
      advancedMetricsSummary.passCompletionRate = `${teamStats.completionRate.toFixed(0)}%`;
    }

    // 4. Build dense match state payload
    const teamStateSummary = `
      Match Format: ${gameType || 'grass'}
      Match Scope: ${isMultiGame ? 'Multiple Games (Aggregated Tournament Data)' : 'Single Game'}
      Total Matches Logged: ${totalGamesCount}
      Current Score: Us ${score?.us || 0} - Them ${score?.them || 0}
      Advanced Match Metrics (Calculated): ${JSON.stringify(advancedMetricsSummary)}
      Roster Performance Summary: ${JSON.stringify(cleanPlayerStats)}
      Point-by-Point Play Log (newest first): ${JSON.stringify(cleanRawStats)}
    `;

    const prompt = `
      System Instruction: You are 'Antigravity Coach Pro', an elite, highly analytical, and motivational Ultimate Frisbee coach. 
      Deliver technical, encouraging huddle briefings and diagnostic suggestions. 
      
      CRITICAL THRESHOLDS & ARITHMETIC RULES FOR ARCHETYPES AND BRIEFINGS:
      1. Huck/Deep Throw rule: If the team's total huck attempts (offensiveHuckIntegrity and defensiveHuckIntegrity sources combined) are under 2% of the team's total throw attempts (which is the sum of passAttempts of all players in the Roster Performance Summary), you are STRICTLY PROHIBITED from mentioning hucks, deep throws, or huck success rates anywhere in the briefings (offensiveBriefing, defensiveBriefing, tacticalBriefing).
      2. The Engine rule: A player CANNOT be designated as "The Engine" if their touchesPerPoint is less than 1.2.
      3. The Difference Maker rule: When evaluating a player for "The Difference Maker", you must calculate their Net Playmaking score as: (goals + assists + secondaryAssists + ds) - turnovers. Only choose players with a positive Net Playmaking score.
      4. Games Played eligibility: A player is ELIGIBLE for any archetype (engine, finisher, differenceMaker) or diagnostic suggestion in "focusAreas" ONLY if they played in at least 50% of the total matches played by the team (Total Matches Logged = ${totalGamesCount}). Filter out players with gamesPlayed < (0.5 * ${totalGamesCount}).
      
      CRITICAL INSTRUCTION: You MUST naturally and explicitly weave the calculated "Advanced Match Metrics" (like Clean Hold Rate, Break Rate, Pass-to-Score ratio, and Huck Integrity) into your narratives. Do not just list them; incorporate them into your sentences to back up your coaching insights with hard numeric proof. 
      Example: "Our offense is running clinical patterns with a clinical 3.2 Pass-to-Score ratio and a 75% Clean Hold Rate..." or "Our transition unit has been ruthless, converting at a 50% Break Rate..."
      
      CRITICAL FORMAT ADAPTATION: You MUST check the "Match Format" in the Input Match State Log. 
      If the Match Format is "grass" or "indoor", you are STRICTLY PROHIBITED from referencing "sand", "beach", "sand footing", "beach wind", or beach tactics ANYWHERE in the entire JSON response, including the narrative paragraphs and the "focusAreas" array of strings. Ensure all parts of the response maintain absolute consistency, utilizing strictly grass-specific terms (e.g., hard pivots, stable turf footing, turf-burns, spikes, cleats, grass, grass wind). 
      If the Match Format is "beach" or "sand", you are STRICTLY PROHIBITED from referencing grass-specific terms like "turf", "grass", "spikes", or "cleats" ANYWHERE in the entire JSON response, including the narrative paragraphs and the "focusAreas" array of strings. Ensure all parts of the response maintain absolute consistency, utilizing strictly beach-specific terms (e.g., sand footing, sand dunes, wind-handling, low-release throws, sand, beach wind).

      CRITICAL SCOPE ADAPTATION: You MUST verify the "Match Scope". If it is "Multiple Games (Aggregated Tournament Data)", formulate your briefings as a high-level retrospective tournament campaign assessment across multiple games. Pivot your vocabulary to reflect tournament progress, consistency, and cumulative fatigue rather than single-game sideline huddle urgency (e.g., refer to "this tournament/campaign", "our overall record", and "across these matches" instead of "this game" or "the next pull"). If it is "Single Game", deliver rapid, in-game sideline huddle diagnostics.
      
      Focus on:
      1. Offensive hold patterns, disc preservation, dump-swing movements, and huck decisions.
      2. Defensive transition conversion, block counts, defensive brackets, and counter-attacks.
      3. 2-3 specific tactical suggestions (e.g. timeout execution, drill focus, defensive adjustments) written in direct, encouraging markdown.
      
      You must respond strictly in valid JSON matching the following structure. Do not include markdown formatting indicators in the JSON itself (like backticks or leading/trailing text), only return the pure JSON object:
      {
        "offensiveBriefing": "markdown paragraph summarizing offensive execution (approximately 3-4 sentences)",
        "defensiveBriefing": "markdown paragraph detailing defensive transition (approximately 3-4 sentences)",
        "tacticalBriefing": "markdown paragraph summarizing 2-3 actionable huddle suggestions (approximately 2-3 sentences)",
        "archetypes": {
          "engine": "player name(s) distributing effectively",
          "finisher": "player name(s) scoring clinical endzone goals",
          "differenceMaker": "player name(s) generating blocks/assists"
        },
        "focusAreas": [
          "Constructive diagnostic suggestion for player X (e.g., focus on resetting earlier in the stall count)",
          "Constructive diagnostic suggestion for player Y (e.g., focus on secure catches before starting cut)"
        ]
      }

      Input Match State Log:
      ${teamStateSummary}
    `;

    // 4. Configure Generative AI Model targeting gemini-2.5-flash with automatic cascading fallback
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.0-flash-lite'];
    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[generate-insights] Attempting generation with model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.25
          }
        });
        result = await model.generateContent(prompt);
        console.log(`[generate-insights] Successfully generated content using model: ${modelName}`);
        break;
      } catch (err) {
        console.error(`[generate-insights] Failed with model ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!result) {
      throw new Error(`All generative models failed. Last error: ${lastError?.message}`);
    }

    const textResponse = result.response.text();
    console.log("[generate-insights] Raw Gemini response:", textResponse);

    // 6. Parse and return the JSON bundle
    const parsedResponse = JSON.parse(textResponse.trim());
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("[generate-insights] Handler Exception:", error);
    return res.status(500).json({ error: "Failed to generate coaching insights.", details: error.message });
  }
}
