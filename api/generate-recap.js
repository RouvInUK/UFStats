import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // CORS & method verification
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
      console.error("[generate-recap] Missing Gemini API Key.");
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const genAI = new GoogleGenerativeAI(resolvedApiKey);
    const { playerStats, rawStats, homeTeamName, awayTeamName, finalScore } = req.body;

    const cleanPlayerStats = playerStats ? playerStats.map(p => ({
      name: p.name,
      goals: p.goals || 0,
      assists: p.assists || 0,
      ds: p.ds || 0,
      turnovers: p.turnovers || 0
    })) : [];

    const cleanRawStats = rawStats ? rawStats.slice(-150).map(s => ({
      player: s.player,
      action: s.stat_type,
      point: s.point_number,
      team: s.team_name
    })) : [];

    const prompt = `
      System Instruction: You are an elite sports journalism writer covering the national Ultimate Frisbee championships. 
      Deliver a compelling, high-quality, and objective sports match recap article summarizing the game.
      
      You must respond strictly in valid JSON matching the following structure. Do not include markdown formatting indicators in the JSON itself (like backticks or leading/trailing text), only return the pure JSON object:
      {
        "headline": "A catchy, objective sports journalism headline covering the match",
        "leadParagraph": "Objective lead paragraph summarizing the final score, match format, and primary takeaway (approximately 3-4 sentences)",
        "momentumParagraph": "An analytical narrative paragraph tracking the key momentum shifts, break sequences, and critical blocks throughout the point log (approximately 4-5 sentences)",
        "starPerformers": "A paragraph highlighting 2-3 standout performers from both rosters based on their clinical goals, blocks, and assists stats (approximately 3-4 sentences)",
        "summary": "A concluding paragraph providing a high-level summary of tournament standings or forward outlook for both teams (approximately 2-3 sentences)"
      }

      Input Match Data Log:
      Home Team: ${homeTeamName || 'Home Team'}
      Away Team: ${awayTeamName || 'Away Team'}
      Final Score: ${homeTeamName} ${finalScore?.home || 0} - ${awayTeamName} ${finalScore?.away || 0}
      Roster Performance Summary: ${JSON.stringify(cleanPlayerStats)}
      Point-by-Point Play Log: ${JSON.stringify(cleanRawStats)}
    `;

    // Cascade models starting at 2.5 Flash to optimize speed and drop costs by 80%+
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.0-flash-lite'];
    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.35
          }
        });
        result = await model.generateContent(prompt);
        break;
      } catch (err) {
        console.error(`[generate-recap] Failed with model ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!result) {
      throw new Error(`All generative models failed. Last error: ${lastError?.message}`);
    }

    const textResponse = result.response.text();
    const parsedResponse = JSON.parse(textResponse.trim());
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("[generate-recap] Exception:", error);
    return res.status(500).json({ error: "Failed to generate sports recap article.", details: error.message });
  }
}
