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
    const { playerStats, rawStats, gameType, score } = req.body;

    // 2. Aggregate and truncate data to fit the context
    const cleanPlayerStats = playerStats ? playerStats.map(p => ({
      name: p.name,
      goals: p.goals || 0,
      assists: p.assists || 0,
      ds: p.ds || 0,
      turnovers: p.turnovers || 0,
      pointsPlayed: p.pp || p.pointsPlayed || 0
    })) : [];

    const cleanRawStats = rawStats ? rawStats.slice(0, 150).map(s => ({
      player: s.player,
      action: s.stat_type,
      point: s.point_number,
      details: s.details || null
    })) : [];

    // 3. Build dense match state payload
    const teamStateSummary = `
      Match Format: ${gameType || 'grass'}
      Current Score: Us ${score?.us || 0} - Them ${score?.them || 0}
      Roster Performance Summary: ${JSON.stringify(cleanPlayerStats)}
      Point-by-Point Play Log (newest first): ${JSON.stringify(cleanRawStats)}
    `;

    const prompt = `
      System Instruction: You are 'Antigravity Coach Pro', an elite, highly analytical, and motivational Ultimate Frisbee coach. Deliver technical, encouraging huddle briefings and diagnostic suggestions. Focus on:
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

    // 4. Configure Generative AI Model targeting gemini-3.5-flash with automatic cascading fallback
    const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
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
