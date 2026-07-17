import { processAgentChat } from './orchestrator';

async function runTest() {
  console.log('==================================================');
  console.log('Running Wayfinding and Agent Routing Unit Tests...');
  console.log('==================================================');

  // Set mock environmental ports/urls for test context
  process.env.NEXT_PUBLIC_SIMULATION_URL = 'http://localhost:3002';

  // Test Case 1: Standard Wayfinding Calculation
  console.log('\n[Test 1] Testing standard wayfinding: Gate B to Seating Lower...');
  const result1 = await processAgentChat('Give me directions from Gate B to Seating Lower');
  console.log('Response:', result1.response);
  if (!result1.routeData) {
    throw new Error('Test 1 Failed: Expected routeData coordinates overlay.');
  }
  if (result1.routeData.accessibleOnly) {
    throw new Error('Test 1 Failed: Expected standard routing, got accessible routing.');
  }
  console.log('✓ Test 1 Passed: Standard route calculated.');

  // Test Case 2: ADA Accessibility Routing Mode
  console.log('\n[Test 2] Testing ADA wheelchair route: Gate A to Seating Upper...');
  const result2 = await processAgentChat(
    'directions from Gate A to Seating Upper, wheelchair accessible',
  );
  console.log('Response:', result2.response);
  if (!result2.routeData) {
    throw new Error('Test 2 Failed: Expected routeData.');
  }
  if (!result2.routeData.accessibleOnly) {
    throw new Error('Test 2 Failed: Expected accessibleOnly = true.');
  }
  console.log('✓ Test 2 Passed: ADA accessible routing logic verified.');

  console.log('\n==================================================');
  console.log('✓ All Agent Core Routing Unit Tests Passed!');
  console.log('==================================================');
}

runTest().catch((err) => {
  console.error('\n❌ Unit Test Failed:', err);
  process.exit(1);
});
