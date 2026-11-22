const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline'; // Admin
const AMAN_TOKEN = 'pg_mock_token_offline_aman';  // Roommate

async function runReportsApiTests() {
  console.log('🧪 Starting Phase 17: Reports & Comparison API Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Monthly Report (Current November 2026)
  console.log('1. Testing Monthly Report for 2026-11...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/monthly?period=2026-11`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /reports/monthly returns 200');
    assert(body.success === true, 'Response has success: true');
    assert(body.report.period === '2026-11', 'Report period is 2026-11');
    assert(body.report.totalRentPaise === 2800000, 'Total rent is ₹28,000 (2,800,000 paise)');
    assert(body.report.totalExpensesPaise > 0, `Total expenses is positive (${body.report.totalExpensesPaise} paise)`);
    assert(body.report.grandTotalPaise === body.report.totalRentPaise + body.report.totalExpensesPaise + body.report.totalCarriedForwardPaise + body.report.totalAdjustmentsPaise, 'Grand total matches sum of components');
    assert(Array.isArray(body.report.categoryBreakdown), 'categoryBreakdown is an array');
    assert(body.report.categoryBreakdown.length > 0, `Found ${body.report.categoryBreakdown.length} expense categories`);

    // Verify category breakdown percentages sum to ~100%
    const totalPercentage = body.report.categoryBreakdown.reduce((sum: number, c: any) => sum + c.percentage, 0);
    assert(Math.abs(totalPercentage - 100) <= 1, `Category percentages sum to ~100% (actual: ${totalPercentage}%)`);

    // Verify member summaries
    assert(Array.isArray(body.report.memberSummaries), 'memberSummaries is an array');
    assert(body.report.memberSummaries.length >= 2, `Member summaries includes at least 2 members (${body.report.memberSummaries.length})`);

    const rahul = body.report.memberSummaries.find((m: any) => m.name === 'Rahul Sharma' || m.userId === 'u1111111-1111-1111-1111-111111111111');
    assert(rahul !== undefined, 'Found Rahul in member summaries');
    assert(rahul?.equalSharePaise > 0, 'Rahul has positive equalSharePaise');
  }

  // 2. Monthly Report (Past October 2026 - Finalized)
  console.log('\n2. Testing Monthly Report for 2026-10 (Finalized)...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/monthly?period=2026-10`, {
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /reports/monthly for 2026-10 returns 200');
    assert(body.report.period === '2026-10', 'Report period is 2026-10');
    assert(body.report.isFinalized === true, 'October report is marked as finalized');
    assert(body.report.memberSummaries.length === 4, 'October had 4 members');
  }

  // 3. Month Comparison (2026-10 vs 2026-11)
  console.log('\n3. Testing Month Comparison (2026-10 vs 2026-11)...');
  {
    const res = await fetch(
      `${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/comparison?basePeriod=2026-10&comparePeriod=2026-11`,
      {
        headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
      }
    );
    const body = await res.json();
    assert(res.status === 200, 'GET /reports/comparison returns 200');
    assert(body.success === true, 'Response has success: true');
    assert(body.basePeriod === '2026-10', 'Base period is 2026-10');
    assert(body.comparePeriod === '2026-11', 'Compare period is 2026-11');

    const comp = body.comparison;
    assert(typeof comp.differenceGrandTotalPaise === 'number', 'differenceGrandTotalPaise is a number');
    assert(typeof comp.differenceExpensesPaise === 'number', 'differenceExpensesPaise is a number');
    assert(typeof comp.percentageChangeGrandTotal === 'number', 'percentageChangeGrandTotal is a number');
    assert(Array.isArray(comp.categoryDeltas), 'categoryDeltas is an array');
    assert(comp.categoryDeltas.length > 0, `Computed deltas for ${comp.categoryDeltas.length} categories`);

    // Check difference matches report values
    const expectedDiff = body.compareReport.grandTotalPaise - body.baseReport.grandTotalPaise;
    assert(comp.differenceGrandTotalPaise === expectedDiff, `Difference in grand total matches (${expectedDiff} paise)`);

    // Verify first delta item has expected structure
    const topDelta = comp.categoryDeltas[0];
    assert(typeof topDelta.name === 'string', `Top shifted category is "${topDelta.name}"`);
    assert(typeof topDelta.baseAmountPaise === 'number', 'Top delta has baseAmountPaise');
    assert(typeof topDelta.compareAmountPaise === 'number', 'Top delta has compareAmountPaise');
    assert(typeof topDelta.deltaPaise === 'number', 'Top delta has deltaPaise');
    assert(typeof topDelta.percentageChange === 'number', 'Top delta has percentageChange');
  }

  // 4. Multi-Period Overview
  console.log('\n4. Testing Multi-Period Overview...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/overview`, {
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /reports/overview returns 200');
    assert(Array.isArray(body.periods), 'periods is an array');
    assert(body.periods.length >= 2, `Overview returns ${body.periods.length} billing cycles`);
    assert(body.periods[0].period === '2026-10', 'First overview cycle is 2026-10');
    assert(body.periods[1].period === '2026-11', 'Second overview cycle is 2026-11');
  }

  // 5. Auth and Validation Error Handling
  console.log('\n5. Testing Validation & Auth Security...');
  {
    // Unauthorized without token
    const noAuthRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/monthly?period=2026-11`);
    assert(noAuthRes.status === 401, 'Request without token rejected with 401 Unauthorized');

    // Invalid period format
    const badPeriodRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/monthly?period=invalid-period`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(badPeriodRes.status === 400, 'Invalid period string rejected with 400 Bad Request');

    // Invalid comparison period format
    const badCompRes = await fetch(
      `${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reports/comparison?basePeriod=bad&comparePeriod=2026-11`,
      {
        headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
      }
    );
    assert(badCompRes.status === 400, 'Invalid comparison period rejected with 400 Bad Request');

    // Room not found
    const notFoundRes = await fetch(`${API_BASE}/api/rooms/r9999999-9999-9999-9999-999999999999/reports/monthly`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(notFoundRes.status === 404, 'Non-existent roomId returns 404 Not Found');
  }

  console.log(`\n========================================`);
  console.log(`Phase 17 API Tests Complete: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runReportsApiTests().catch((err) => {
  console.error('Fatal error running reports API tests:', err);
  process.exit(1);
});
