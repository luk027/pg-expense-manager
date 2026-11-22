const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline';
const AMAN_TOKEN = 'pg_mock_token_offline_aman';

async function runTests() {
  console.log('🧪 Starting Phase 10: Settlement Engine API Tests...\n');
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

  try {
    // 1. GET Room Settlements List
    console.log('1. Testing Settlements Listing...');
    const listRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /settlements returns 200');
    assert(Array.isArray(listData.settlements), 'Returns array of settlements');
    const hasOct = listData.settlements.some((s: any) => s.period === '2026-10');
    const hasNov = listData.settlements.some((s: any) => s.period === '2026-11');
    assert(hasOct, 'Contains October 2026 settlement');
    assert(hasNov, 'Contains November 2026 settlement');

    // 2. GET Finalized October Settlement
    console.log('\n2. Testing Finalized Settlement Retrieval...');
    const octRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements/2026-10`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const octData = await octRes.json();
    assert(octRes.status === 200, 'GET /settlements/2026-10 returns 200');
    assert(octData.isFinalized === true, 'October settlement is finalized');
    assert(octData.settlement.grandTotalPaise === 3160000, 'Grand total matches ₹31,600 (3,160,000 paise)');
    assert(octData.memberShares.length === 4, 'Contains shares for all 4 roommates');

    // 3. GET Draft November Settlement
    console.log('\n3. Testing Draft Real-Time Settlement...');
    const novRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements/2026-11`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const novData = await novRes.json();
    assert(novRes.status === 200, 'GET /settlements/2026-11 returns 200');
    assert(novData.isFinalized === false, 'November settlement starts in draft state');
    assert(novData.settlement.totalRentPaise === 2800000, 'Rent equals ₹28,000 (2,800,000 paise)');
    assert(novData.settlement.totalExpensesPaise > 0, 'Expenses aggregated from room expenses');

    // 4. GET Full Statement with Line Items
    console.log('\n4. Testing Full Itemized Statement...');
    const stmtRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements/2026-11/statement`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const stmtData = await stmtRes.json();
    assert(stmtRes.status === 200, 'GET /settlements/2026-11/statement returns 200');
    assert(!!stmtData.statement, 'Statement payload present');
    assert(Array.isArray(stmtData.statement.lineItems), 'Contains lineItems array');
    assert(stmtData.statement.lineItems.length >= 1, 'Line items include Rent and expenses');
    assert(stmtData.statement.memberStatements.length === 4, 'Includes 4 memberStatements');

    // Verify mathematical invariant on statement
    const totalNetOwed = stmtData.statement.memberStatements.reduce((sum: number, m: any) => sum + m.netAmountOwedPaise, 0);
    const expectedTotal = stmtData.statement.totalRentPaise + stmtData.statement.totalCarriedForwardPaise + stmtData.statement.totalAdjustmentsPaise;
    assert(totalNetOwed === expectedTotal, `Net balance invariant satisfied: sum(owed)=${totalNetOwed} === rent+carried=${expectedTotal}`);

    // 5. POST Finalize December Settlement
    console.log('\n5. Testing Settlement Finalization Workflow...');
    const finalizeRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements/2026-12/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const finalizeData = await finalizeRes.json();
    assert(finalizeRes.status === 201, 'POST /finalize returns 201 Created');
    assert(finalizeData.success === true, 'Finalization success flag is true');
    assert(finalizeData.settlement.status === 'finalized', 'Settlement status changed to finalized');
    assert(!!finalizeData.settlement.finalizedAt, 'finalizedAt timestamp is recorded');
    assert(finalizeData.memberShares.length === 4, 'Locked member shares stored');

    // 6. Test Idempotency (Cannot finalize twice)
    console.log('\n6. Testing Double-Finalization Prevention...');
    const repeatFinalizeRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements/2026-12/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(repeatFinalizeRes.status === 400, 'Second finalization rejected with 400 Bad Request');

    // 7. Test Activity Audit Log
    console.log('\n7. Testing Audit Trail Logging...');
    const activityRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const activityData = await activityRes.json();
    const hasFinalizedLog = activityData.logs.some((l: any) => l.action === 'settlement_finalized');
    assert(hasFinalizedLog, 'Activity log records settlement_finalized event');

    // 8. Access Control & Validation
    console.log('\n8. Testing Validation & Security...');
    const invalidPeriodRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements/invalid-date`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(invalidPeriodRes.status === 400, 'Invalid period string rejected with 400');

    const unauthRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/settlements`, {
      headers: { Authorization: 'Bearer bad_token' },
    });
    assert(unauthRes.status === 401, 'Unauthorized request rejected with 401');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Phase 10 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
