/**
 * Playbook Ingestion Engine (playbookParser.js)
 * Implements a hybrid coordinate parser:
 * - Online: Sends play diagrams to Gemini Vision API for structured coordinate analysis.
 * - Offline: Falls back to high-fidelity template blueprints (Vertical Stack, Horizontal Stack, Zone Cup).
 */

export const OFFLINE_BLUEPRINTS = {
  vertical_stack: {
    stackType: 'vertical',
    name: 'Vertical Stack',
    positions: [
      { role: 'Handler', x: 50, y: 15, description: 'Pivot / Active Thrower' },
      { role: 'Handler', x: 35, y: 10, description: 'Dump / Reset Option' },
      { role: 'Handler', x: 65, y: 10, description: 'Swing / Fill Option' },
      { role: 'Cutter', x: 50, y: 35, description: 'Front of Stack' },
      { role: 'Cutter', x: 50, y: 48, description: 'Mid Cutter 1' },
      { role: 'Cutter', x: 50, y: 60, description: 'Mid Cutter 2' },
      { role: 'Cutter', x: 50, y: 72, description: 'Deep Cutter (Back of Stack)' }
    ],
    zones: [
      { name: 'Open Side Cutting Lane', xMin: 55, xMax: 95, yMin: 25, yMax: 75 },
      { name: 'Break Side Reset Space', xMin: 5, xMax: 40, yMin: 5, yMax: 30 },
      { name: 'Deep Space', xMin: 20, xMax: 80, yMin: 75, yMax: 100 }
    ]
  },
  horizontal_stack: {
    stackType: 'horizontal',
    name: 'Horizontal Stack',
    positions: [
      { role: 'Handler', x: 50, y: 15, description: 'Center Handler' },
      { role: 'Handler', x: 25, y: 13, description: 'Left Handler' },
      { role: 'Handler', x: 75, y: 13, description: 'Right Handler' },
      { role: 'Cutter', x: 20, y: 45, description: 'Left Wing Cutter' },
      { role: 'Cutter', x: 40, y: 45, description: 'Left Center Cutter' },
      { role: 'Cutter', x: 60, y: 45, description: 'Right Center Cutter' },
      { role: 'Cutter', x: 80, y: 45, description: 'Right Wing Cutter' }
    ],
    zones: [
      { name: 'Under Cutting Space', xMin: 15, xMax: 85, yMin: 20, yMax: 40 },
      { name: 'Break Side Deep Lane', xMin: 5, xMax: 35, yMin: 45, yMax: 90 },
      { name: 'Open Side Deep Lane', xMin: 65, xMax: 95, yMin: 45, yMax: 90 }
    ]
  },
  zone_cup: {
    stackType: 'zone_cup',
    name: 'Zone Cup (3-3-1)',
    positions: [
      { role: 'Handler', x: 50, y: 15, description: 'Center Handler' },
      { role: 'Handler', x: 30, y: 12, description: 'Left Handler Reset' },
      { role: 'Handler', x: 70, y: 12, description: 'Right Handler Reset' },
      { role: 'Cutter', x: 15, y: 45, description: 'Left Wing Cutter' },
      { role: 'Cutter', x: 85, y: 45, description: 'Right Wing Cutter' },
      { role: 'Cutter', x: 50, y: 55, description: 'Middle-Middle Cutter' },
      { role: 'Cutter', x: 50, y: 78, description: 'Deep Cutter' }
    ],
    zones: [
      { name: 'Over the Cup Reset Space', xMin: 25, xMax: 75, yMin: 22, yMax: 42 },
      { name: 'Deep Space', xMin: 10, xMax: 90, yMin: 70, yMax: 100 },
      { name: 'Wing Cutting Lanes', xMin: 5, xMax: 25, yMin: 35, yMax: 65 }
    ]
  }
};

/**
 * Parses a playbook file (image/PDF) either online via Gemini serverless function
 * or offline using standard fallback stack blueprints.
 * 
 * @param {File|string} playbookInput - File object or Base64 string of playbook image.
 * @param {string} fallbackType - One of 'vertical_stack', 'horizontal_stack', 'zone_cup'.
 * @returns {Promise<Object>} The parsed playbook coordinate blueprint.
 */
export async function parsePlaybookDiagram(playbookInput, fallbackType = 'vertical_stack') {
  const fallback = OFFLINE_BLUEPRINTS[fallbackType] || OFFLINE_BLUEPRINTS.vertical_stack;
  
  if (!playbookInput) {
    console.log("[playbookParser] No file provided, defaulting to blueprint:", fallback.name);
    return fallback;
  }

  try {
    // Attempt online parsing
    let base64Data = '';
    
    if (playbookInput instanceof File) {
      base64Data = await fileToBase64(playbookInput);
    } else if (typeof playbookInput === 'string') {
      base64Data = playbookInput;
    }

    if (!base64Data) {
      console.warn("[playbookParser] Could not convert input to base64, falling back.");
      return fallback;
    }

    console.log("[playbookParser] Triggering multi-modal online parser...");
    const response = await fetch('/api/parse-playbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data })
    });

    if (!response.ok) {
      throw new Error(`Server returned error status: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.stackType && data.positions && data.zones) {
      console.log("[playbookParser] Successfully parsed playbook diagram using Gemini Vision.");
      return data;
    }

    throw new Error("Invalid schema returned by parsing server.");
  } catch (err) {
    console.warn("[playbookParser] Online parser failed, using local offline fallback blueprint:", fallback.name, err);
    return fallback;
  }
}

/**
 * Helper to check if a turnover coordinate falls within any of the defined tactical zones.
 * 
 * @param {number} x - Coordinate x (0-100)
 * @param {number} y - Coordinate y (0-100)
 * @param {Array<Object>} zones - Bounding boxes array
 * @returns {string|null} The name of the matching zone, or null.
 */
export function getZoneForCoordinate(x, y, zones) {
  if (!zones || !Array.isArray(zones)) return null;
  
  for (const zone of zones) {
    if (x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax) {
      return zone.name;
    }
  }
  return null;
}

/**
 * Convert File to base64 string
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Extract pure base64 from dataURL
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}
