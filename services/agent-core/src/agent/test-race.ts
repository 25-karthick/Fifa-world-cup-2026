import { processAgentChat } from './orchestrator';

async function runRaceTest() {
  console.log('==================================================');
  console.log('Running Concurrent Race Condition & Intent Tests...');
  console.log('==================================================');

  // Set mock env URLs
  process.env.NEXT_PUBLIC_SIMULATION_URL = 'http://localhost:3002';

  console.log('[Test] Firing 2 concurrent queries in quick succession via Promise.all...');

  // Send both queries concurrently
  const [res1, res2] = await Promise.all([
    processAgentChat('which year the statuim was build'),
    processAgentChat('where can i get the water'),
  ]);

  console.log("\n[Request 1]: 'which year the statuim was build'");
  console.log('Response 1:', res1.response);

  console.log("\n[Request 2]: 'where can i get the water'");
  console.log('Response 2:', res2.response);

  // Assertions
  // Request 1 must return details about the stadium's opening (2010)
  if (!res1.response.includes('2010')) {
    throw new Error("FAIL: Request 1 response does not contain the opening year '2010'!");
  }
  // Request 1 must NOT bleed into Request 2 context, and vice versa
  if (
    res1.response.toLowerCase().includes('refill') ||
    res1.response.toLowerCase().includes('restroom')
  ) {
    throw new Error('FAIL: Request 1 contains water refill context! Data leakage detected.');
  }

  // Request 2 must return details about water refills, not bag policies or years
  if (
    !res2.response.toLowerCase().includes('refill') &&
    !res2.response.toLowerCase().includes('restroom')
  ) {
    throw new Error('FAIL: Request 2 response does not contain water refill station details!');
  }
  if (res2.response.includes('2010')) {
    throw new Error('FAIL: Request 2 contains stadium opening year! Data leakage detected.');
  }

  console.log('\n==================================================');
  console.log('✓ SUCCESS: No race conditions detected!');
  console.log('✓ both responses correctly mapped to original requests.');
  console.log('==================================================');
  process.exit(0);
}

runRaceTest().catch((err) => {
  console.error('\n❌ Race Test Failed:', err);
  process.exit(1);
});
