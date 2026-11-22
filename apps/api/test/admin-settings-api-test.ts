const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline'; // Admin
const AMAN_TOKEN = 'pg_mock_token_offline_aman';  // Roommate

async function runAdminSettingsApiTests() {
  console.log('🧪 Starting Phase 19: Room Settings & Admin Features API Tests...\n');
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

  // ==========================================
  // 1. Category Management Tests
  // ==========================================
  console.log('1. Testing Category Management (Add, Rename, Disable, Delete)...');
  let createdCatId = '';
  {
    // List categories
    const listRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const listBody = await listRes.json();
    assert(listRes.status === 200, 'GET /categories returns 200');
    assert(Array.isArray(listBody.categories), 'categories is an array');
    assert(listBody.categories.length >= 5, `Pre-seeded categories present (${listBody.categories.length})`);

    // Non-admin cannot add category
    const forbiddenRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AMAN_TOKEN}` },
      body: JSON.stringify({ name: 'Unauthorized Category' }),
    });
    assert(forbiddenRes.status === 403, 'Non-admin cannot add category (403 Forbidden)');

    // Admin adds new category
    const addRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ name: 'Balcony Plants' }),
    });
    const addBody = await addRes.json();
    assert(addRes.status === 201, 'POST /categories by admin returns 201 Created');
    assert(addBody.success === true, 'Category creation returns success: true');
    assert(addBody.category.name === 'Balcony Plants', 'Created category name is Balcony Plants');
    assert(addBody.category.isActive === true, 'New category is active by default');
    createdCatId = addBody.category.id;

    // Duplicate name rejected with 409
    const dupRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ name: 'balcony plants' }),
    });
    assert(dupRes.status === 409, 'Duplicate category name rejected with 409 Conflict');

    // Admin renames category
    const renameRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories/${createdCatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ name: 'Indoor & Balcony Plants' }),
    });
    const renameBody = await renameRes.json();
    assert(renameRes.status === 200, 'PATCH /categories/:id returns 200');
    assert(renameBody.category.name === 'Indoor & Balcony Plants', 'Category successfully renamed');

    // Admin toggles category active status
    const disableRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories/${createdCatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ isActive: false }),
    });
    const disableBody = await disableRes.json();
    assert(disableRes.status === 200, 'PATCH /categories/:id disable returns 200');
    assert(disableBody.category.isActive === false, 'Category isActive toggled to false');

    // Admin deletes unused category
    const delRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories/${createdCatId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const delBody = await delRes.json();
    assert(delRes.status === 200, 'DELETE /categories/:id returns 200');
    assert(delBody.action === 'deleted', 'Unused category is completely removed');

    // Admin attempts to delete in-use / default category (e.g. Rent)
    const rentCat = listBody.categories.find((c: any) => c.name.toLowerCase() === 'rent');
    if (rentCat) {
      const delRentRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories/${rentCat.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
      });
      const delRentBody = await delRentRes.json();
      assert(delRentRes.status === 200, 'DELETE on in-use category returns 200');
      assert(delRentBody.action === 'disabled', 'In-use category is safely soft-disabled instead of deleted');
    }
  }

  // ==========================================
  // 2. Rent Management & History Tests
  // ==========================================
  console.log('\n2. Testing Rent Management with Effective Dates & History...');
  {
    // Retrieve rent history
    const histRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent/history`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const histBody = await histRes.json();
    assert(histRes.status === 200, 'GET /rent/history returns 200');
    assert(typeof histBody.currentRentPaise === 'number', `Current rent is ${histBody.currentRentPaise} paise`);
    assert(Array.isArray(histBody.history), 'Rent history is an array');
    assert(histBody.history.length >= 1, 'Pre-seeded initial rent history record present');

    // Non-admin cannot modify rent
    const forbiddenRentRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AMAN_TOKEN}` },
      body: JSON.stringify({ newRentPaise: 3000000, effectiveFrom: '2026-12-01' }),
    });
    assert(forbiddenRentRes.status === 403, 'Non-admin modifying rent rejected with 403 Forbidden');

    // Invalid rent amount (zero or negative)
    const badRentRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ newRentPaise: -5000, effectiveFrom: '2026-12-01' }),
    });
    assert(badRentRes.status === 400, 'Negative rent rejected with 400 Bad Request');

    // Invalid date format
    const badDateRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ newRentPaise: 3000000, effectiveFrom: 'invalid-date' }),
    });
    assert(badDateRes.status === 400, 'Invalid effective date format rejected with 400 Bad Request');

    // Admin updates rent with effective date
    const updateRentRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({
        newRentPaise: 3000000, // ₹30,000
        effectiveFrom: '2026-12-01',
        reason: 'Annual landlord lease escalation (7.1%)',
      }),
    });
    const updateRentBody = await updateRentRes.json();
    assert(updateRentRes.status === 201, 'POST /rent returns 201 Created');
    assert(updateRentBody.room.monthlyRentPaise === 3000000, 'Room monthlyRentPaise updated to 3,000,000 paise (₹30,000)');
    assert(updateRentBody.rentRecord.effectiveFrom === '2026-12-01', 'Rent record effectiveFrom is 2026-12-01');
    assert(updateRentBody.rentRecord.previousRentPaise === 2800000, 'Previous rent captured as 2,800,000 paise');

    // Verify history now includes the new record
    const verifyHistRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent/history`, {
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    const verifyHistBody = await verifyHistRes.json();
    assert(verifyHistBody.history[0].newRentPaise === 3000000, 'Top history record reflects latest rent change');
    assert(verifyHistBody.history[0].reason === 'Annual landlord lease escalation (7.1%)', 'Reason captured in history');

    // Revert rent back to ₹28,000 for regular demo operation
    await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({
        newRentPaise: 2800000,
        effectiveFrom: '2026-11-01',
        reason: 'Reset to demo default',
      }),
    });
  }

  // ==========================================
  // 3. Room Closure Flow & Balance Checks
  // ==========================================
  console.log('\n3. Testing Room Closure Flow & Balance Warning...');
  {
    // Close-check endpoint
    const checkRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/close-check`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const checkBody = await checkRes.json();
    assert(checkRes.status === 200, 'GET /close-check returns 200');
    assert(checkBody.canClose === true, 'canClose is true');
    assert(typeof checkBody.hasUnsettledBalances === 'boolean', 'hasUnsettledBalances flag present');
    assert(typeof checkBody.warning === 'string', `Warning message generated: "${checkBody.warning}"`);

    // Non-admin attempting to close room
    const nonAdminCloseRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AMAN_TOKEN}` },
      body: JSON.stringify({ force: false }),
    });
    assert(nonAdminCloseRes.status === 403, 'Non-admin closing room rejected with 403 Forbidden');

    // Attempting to close room without force when balances exist returns 409
    if (checkBody.hasUnsettledBalances) {
      const unforcedCloseRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
        body: JSON.stringify({ force: false }),
      });
      assert(unforcedCloseRes.status === 409, 'Closing with unsettled balances returns 409 Conflict without force');
      const unforcedBody = await unforcedCloseRes.json();
      assert(unforcedBody.requiresForce === true, 'Response specifies requiresForce: true');
    }

    // Force close room
    const forceCloseRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ force: true }),
    });
    const forceCloseBody = await forceCloseRes.json();
    assert(forceCloseRes.status === 200, 'POST /close with force: true returns 200');
    assert(forceCloseBody.room.status === 'closed', 'Room status updated to closed');
    assert(typeof forceCloseBody.room.closedAt === 'string', 'closedAt timestamp recorded');

    // Verify closed room blocks modifications
    const blockedRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAHUL_TOKEN}` },
      body: JSON.stringify({ newRentPaise: 3500000, effectiveFrom: '2026-12-01' }),
    });
    assert(blockedRes.status === 404 || blockedRes.status === 403, 'Closed room blocks rent modifications');

    // Reopen room
    const reopenRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/reopen`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const reopenBody = await reopenRes.json();
    assert(reopenRes.status === 200, 'POST /reopen returns 200');
    assert(reopenBody.room.status === 'active', 'Room restored to active status');
    assert(reopenBody.room.closedAt === undefined, 'closedAt cleared on reopen');
  }

  // ==========================================
  // 4. Security & Permissions
  // ==========================================
  console.log('\n4. Testing Security & Permissions...');
  {
    // Request without token
    const noTokenRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/rent/history`);
    assert(noTokenRes.status === 401, 'Request without token rejected with 401 Unauthorized');

    // Non-existent room
    const badRoomRes = await fetch(`${API_BASE}/api/rooms/r9999999-9999-9999-9999-999999999999/rent/history`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(badRoomRes.status === 404, 'Non-existent roomId returns 404 Not Found');
  }

  console.log(`\n========================================`);
  console.log(`Phase 19 API Tests Complete: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminSettingsApiTests().catch((err) => {
  console.error('Fatal error running admin settings API tests:', err);
  process.exit(1);
});
