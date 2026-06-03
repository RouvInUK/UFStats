import { parsePlaybookDiagram, getZoneForCoordinate, OFFLINE_BLUEPRINTS } from '../src/utils/playbookParser.js';

console.log("=== STARTING PLAYBOOK PARSER OFFLINE TESTS ===");

// Test 1: Verify offline blueprints loads successfully
console.log("\n[Test 1] Loading default Vertical Stack blueprint...");
parsePlaybookDiagram(null, 'vertical_stack')
  .then(blueprint => {
    if (blueprint.stackType === 'vertical' && blueprint.positions.length === 7) {
      console.log("✓ Test 1 Passed: Successfully resolved Vertical Stack blueprint with 7 players!");
    } else {
      console.error("✗ Test 1 Failed: Vertical Stack blueprint resolved incorrectly:", blueprint);
    }
  });

// Test 2: Verify coordinate mapping boundaries
console.log("\n[Test 2] Verifying getZoneForCoordinate mappings...");
const testZones = OFFLINE_BLUEPRINTS.vertical_stack.zones;

// Let's test the coordinates
const openSideCoordinate = { x: 75, y: 50 }; // Should fall inside 'Open Side Cutting Lane' (x: 55-95, y: 25-75)
const deepCoordinate = { x: 50, y: 80 };      // Should fall inside 'Deep Space' (x: 20-80, y: 75-100)
const unmappedCoordinate = { x: 10, y: 50 };  // Should be unmapped (null)

const zone1 = getZoneForCoordinate(openSideCoordinate.x, openSideCoordinate.y, testZones);
const zone2 = getZoneForCoordinate(deepCoordinate.x, deepCoordinate.y, testZones);
const zone3 = getZoneForCoordinate(unmappedCoordinate.x, unmappedCoordinate.y, testZones);

if (zone1 === 'Open Side Cutting Lane') {
  console.log("✓ Test 2.1 Passed: Correctly identified Open Side Cutting Lane");
} else {
  console.error("✗ Test 2.1 Failed: Zone resolved to:", zone1);
}

if (zone2 === 'Deep Space') {
  console.log("✓ Test 2.2 Passed: Correctly identified Deep Space");
} else {
  console.error("✗ Test 2.2 Failed: Zone resolved to:", zone2);
}

if (zone3 === null) {
  console.log("✓ Test 2.3 Passed: Correctly ignored unmapped space");
} else {
  console.error("✗ Test 2.3 Failed: Unmapped space resolved to:", zone3);
}

console.log("\n=== PLAYBOOK PARSER OFFLINE TESTS COMPLETED ===");
