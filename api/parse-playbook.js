import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // 1. Configure secure CORS headers
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
      console.error("[parse-playbook] Missing Gemini API Key environment variable.");
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body." });
    }

    const genAI = new GoogleGenerativeAI(resolvedApiKey);

    // Prompt instructing the vision model to detect players and map coordinate grids
    const prompt = `
      You are 'Antigravity Playbook parser', a specialized coordinate mapping engine for Ultimate Frisbee playbooks.
      
      Look at this Ultimate Frisbee playbook diagram. Identify the locations of:
      1. Handlers: Typically marked by circles, the letter 'H', or positioned near the thrower/disc icon.
      2. Cutters: Typically marked by squares, triangles, the letter 'C', or positioned downfield.
      
      Map their positions on a normalized coordinate field grid from (0,0) in the bottom-left corner to (100,100) in the top-right corner, where the thrower's endzone is at the bottom (y=0 to y=15) and the target scoring endzone is at the top (y=85 to y=100).
      
      Additionally, identify 2 to 4 major tactical zones based on the drawing (e.g. "Open Side Deep Lane", "Break Side Reset Space", "Under Cutting Lane"). Return these zones as absolute bounding boxes with xMin, xMax, yMin, and yMax coordinate coordinates on our 100x100 grid.
      
      Classify the play's defensive or offensive structure into one of these standard styles: "vertical", "horizontal", "zone_cup", or "custom".
      
      You must respond strictly in valid JSON matching the following structure. Do not include markdown formatting indicators in the JSON itself (like backticks or leading/trailing text), only return the pure JSON object:
      {
        "stackType": "vertical" | "horizontal" | "zone_cup" | "custom",
        "name": "A descriptive name for the play, e.g. Vertical Stack, Ho Stack Break Reset",
        "positions": [
          { "role": "Handler" | "Cutter", "x": number, "y": number, "description": "e.g. Center Handler, Back of Stack, Left Wing" }
        ],
        "zones": [
          { "name": "Zone Name", "xMin": number, "xMax": number, "yMin": number, "yMax": number }
        ]
      }
    `;

    // Package base64 image data for Gemini Vision SDK
    const imgPart = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png"
      }
    };

    // Cascade options for maximum model availability
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.0-flash-lite'];
    let result = null;
    let lastError = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`[parse-playbook] Requesting vision analysis using model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });
        result = await model.generateContent([prompt, imgPart]);
        console.log(`[parse-playbook] Successfully compiled vision coordinates with model: ${modelName}`);
        break;
      } catch (err) {
        console.error(`[parse-playbook] Failed model ${modelName}:`, err.message);
        lastError = err;
      }
    }

    if (!result) {
      throw new Error(`All generative models failed. Last error: ${lastError?.message}`);
    }

    const textResponse = result.response.text();
    console.log("[parse-playbook] Raw Gemini Vision response:", textResponse);

    const parsedResponse = JSON.parse(textResponse.trim());
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("[parse-playbook] Handler Exception:", error);
    return res.status(500).json({ error: "Failed to parse playbook diagram.", details: error.message });
  }
}
