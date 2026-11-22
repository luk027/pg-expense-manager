const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline'; // Admin
const AMAN_TOKEN = 'pg_mock_token_offline_aman';  // Roommate

async function runServicesApiTests() {
  console.log('🧪 Starting Phase 13: Water Delivery & Services API Tests...\n');
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

  // 1. Service Configs Listing
  console.log('1. Testing Service Configurations Listing...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/services/configs`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /services/configs returns 200');
    assert(body.activePrices?.waterPricePaise === 4000, 'Default active water price is ₹40 (4,000 paise)');
    assert(body.activePrices?.cleanerPricePaise === 300000, 'Default active cleaner price is ₹3,000 (300,000 paise)');
  }

  // 2. Service Config Price Update (Admin vs Non-Admin)
  console.log('\n2. Testing Service Config Price Update...');
  {
    // Non-admin attempt should be 403
    const forbiddenRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/services/configs`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        serviceType: 'water',
        pricePaise: 5000,
        effectiveFrom: '2026-12-01',
      }),
    });
    assert(forbiddenRes.status === 403, 'Non-admin updating service price rejected with 403 Forbidden');

    // Admin update succeeds
    const adminRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/services/configs`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        serviceType: 'water',
        pricePaise: 5000,
        effectiveFrom: '2026-12-01',
      }),
    });
    const body = await adminRes.json();
    assert(adminRes.status === 200, 'Admin updating service price returns 200');
    assert(body.config?.pricePaise === 5000, 'Admin successfully updated water price to ₹50 effective Dec 1');
  }

  // 3. Water Deliveries Listing (Period Filtering & Multiple Same Day)
  console.log('\n3. Testing Water Deliveries Listing...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries?period=2026-11`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /water-deliveries returns 200');
    assert(Array.isArray(body.deliveries) && body.deliveries.length >= 8, 'November deliveries retrieved successfully');

    // Verify Nov 12 PRD example has 2 deliveries totaling ₹80
    const nov12Deliveries = body.deliveries.filter((d: any) => d.deliveryDate === '2026-11-12');
    assert(nov12Deliveries.length === 2, 'November 12 has 2 deliveries');
    const nov12Total = nov12Deliveries.reduce((sum: number, d: any) => sum + d.pricePaise, 0);
    assert(nov12Total === 8000, 'November 12 deliveries total ₹80 (8,000 paise)');
  }

  // 4. Quick-tap Delivery Recording
  let createdDeliveryId = '';
  console.log('\n4. Testing Quick-Tap Water Delivery Recording...');
  {
    const idemKey = `idem-test-qt-${Date.now()}`;
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        idempotencyKey: idemKey,
      }),
    });
    const body = await res.json();
    assert(res.status === 201, 'POST /water-deliveries quick-tap returns 201 Created');
    assert(body.delivery?.recordedByName === 'Aman Verma', 'Payer recorded correctly as Aman Verma');
    assert(body.delivery?.pricePaise === 4000, 'Uses active room water price (₹40)');
    createdDeliveryId = body.delivery?.id;

    // Duplicate idempotency test
    const dupRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        idempotencyKey: idemKey,
      }),
    });
    const dupBody = await dupRes.json();
    assert(dupRes.status === 200, 'Duplicate idempotency request returns 200');
    assert(dupBody.delivery?.id === createdDeliveryId, 'Duplicate idempotency safely returns existing delivery');
    assert(dupBody.idempotent === true, 'Response marked as idempotent');
  }

  // 5. Future Date Validation
  console.log('\n5. Testing Future Date Validation...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        deliveryDate: '2099-12-31',
        deliveryTime: '10:00',
        idempotencyKey: `idem-future-${Date.now()}`,
      }),
    });
    const body = await res.json();
    assert(res.status === 400, 'Future delivery date correctly blocked with 400');
    assert(body.error === 'Future delivery dates are not allowed', 'Proper error message returned');
  }

  // 6. Bulk Backdating Multiple Past Deliveries
  console.log('\n6. Testing Bulk Backdating Multiple Deliveries...');
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        entries: [
          { deliveryDate: '2026-11-01', deliveryTime: '08:30' },
          { deliveryDate: '2026-11-03', deliveryTime: '17:00' },
        ],
        idempotencyKey: `idem-bulk-${Date.now()}`,
      }),
    });
    const body = await res.json();
    assert(res.status === 201, 'POST /water-deliveries/bulk returns 201 Created');
    assert(body.count === 2, 'Bulk backdated deliveries created 2 entries');
  }

  // 7. Soft Delete / Undo Delivery
  console.log('\n7. Testing Delivery Deletion / Undo...');
  {
    const deleteRes = await fetch(
      `${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries/${createdDeliveryId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
      }
    );
    assert(deleteRes.status === 200, 'DELETE /water-deliveries/:id returns 200');

    // Confirm it is excluded from list
    const listRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/water-deliveries`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const listBody = await listRes.json();
    const found = listBody.deliveries.some((d: any) => d.id === createdDeliveryId);
    assert(!found, 'Deleted delivery is excluded from subsequent queries');
  }

  console.log(`\n========================================`);
  console.log(`Phase 13 API Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runServicesApiTests().catch((err) => {
  console.error('❌ Services API test failed:', err);
  process.exit(1);
});
