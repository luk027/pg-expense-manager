const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline'; // Admin
const AMAN_TOKEN = 'pg_mock_token_offline_aman';  // Roommate

async function runActivityApiTests() {
  console.log('🧪 Starting Phase 18: Activity History & Audit Log API Tests...\n');
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

  // 1. Activity Listing with Default Pagination
  console.log('1. Testing Activity Listing with Default Pagination...');
  let sampleActivityId = '';
  {
    const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const body = await res.json();
    assert(res.status === 200, 'GET /activity returns 200');
    assert(body.success === true, 'Response has success: true');
    assert(Array.isArray(body.activities), 'activities is an array');
    assert(body.activities.length > 0, `Returned ${body.activities.length} activity items`);
    assert(body.pagination !== undefined, 'Pagination metadata is present');
    assert(body.pagination.page === 1, 'Default page is 1');
    assert(body.pagination.limit === 20, 'Default limit is 20');
    assert(typeof body.pagination.total === 'number', `Total activities count: ${body.pagination.total}`);
    assert(body.filterCounts !== undefined, 'filterCounts is present');
    assert(body.filterCounts.all === body.pagination.total, 'filterCounts.all matches total');
    assert(body.filterCounts.expenses > 0, `Found ${body.filterCounts.expenses} expense events`);
    assert(body.filterCounts.payments > 0, `Found ${body.filterCounts.payments} payment events`);

    const first = body.activities[0];
    sampleActivityId = first.id;
    assert(typeof first.id === 'string', 'First item has valid ID');
    assert(typeof first.title === 'string', `First item title: "${first.title}"`);
    assert(typeof first.description === 'string', 'First item has description');
    assert(typeof first.userName === 'string', `First item actor: ${first.userName}`);
    assert(typeof first.createdAt === 'string', 'First item has ISO timestamp');
    assert(['expense', 'payment', 'settlement', 'water', 'room', 'member'].includes(first.entityType), `Valid entityType: ${first.entityType}`);
  }

  // 2. Entity Type Filtering
  console.log('\n2. Testing Entity Type Filtering (expenses, payments, settlements, water, room)...');
  {
    // Filter by expenses
    const expRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?filter=expenses`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const expBody = await expRes.json();
    assert(expRes.status === 200, 'GET /activity?filter=expenses returns 200');
    assert(expBody.activities.every((a: any) => a.entityType === 'expense'), 'All filtered items are expense events');

    // Filter by payments
    const payRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?filter=payments`, {
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    const payBody = await payRes.json();
    assert(payRes.status === 200, 'GET /activity?filter=payments returns 200');
    assert(payBody.activities.every((a: any) => a.entityType === 'payment'), 'All filtered items are payment events');

    // Filter by settlements
    const setRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?filter=settlements`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const setBody = await setRes.json();
    assert(setRes.status === 200, 'GET /activity?filter=settlements returns 200');
    assert(setBody.activities.every((a: any) => a.entityType === 'settlement'), 'All filtered items are settlement events');

    // Filter by water
    const waterRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?filter=water`, {
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    const waterBody = await waterRes.json();
    assert(waterRes.status === 200, 'GET /activity?filter=water returns 200');
    assert(waterBody.activities.every((a: any) => a.entityType === 'water'), 'All filtered items are water/service events');

    // Filter by room
    const roomRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?filter=room`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const roomBody = await roomRes.json();
    assert(roomRes.status === 200, 'GET /activity?filter=room returns 200');
    assert(roomBody.activities.every((a: any) => a.entityType === 'room' || a.entityType === 'member'), 'All filtered items are room/member events');
  }

  // 3. Pagination Verification (No Duplicates across pages)
  console.log('\n3. Testing Pagination & Infinite Scroll Consistency...');
  {
    const page1Res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const page1 = await page1Res.json();
    assert(page1.activities.length === 5, 'Page 1 returns exactly 5 items');
    assert(page1.pagination.hasMore === true, 'Page 1 reports hasMore: true');

    const page2Res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?page=2&limit=5`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const page2 = await page2Res.json();
    assert(page2.activities.length === 5, 'Page 2 returns exactly 5 items');

    const page1Ids = new Set(page1.activities.map((a: any) => a.id));
    const hasOverlap = page2.activities.some((a: any) => page1Ids.has(a.id));
    assert(!hasOverlap, 'Zero overlap/duplicates between page 1 and page 2');
  }

  // 4. Single Activity Detail Retrieval
  console.log('\n4. Testing Activity Detail Retrieval...');
  {
    const detailRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity/${sampleActivityId}`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const detailBody = await detailRes.json();
    assert(detailRes.status === 200, 'GET /activity/:id returns 200');
    assert(detailBody.success === true, 'Response has success: true');
    assert(detailBody.activity.id === sampleActivityId, 'Activity ID matches requested ID');
    assert(typeof detailBody.activity.title === 'string', 'Detail has title');
    assert(typeof detailBody.activity.details === 'object', 'Detail has details object');
  }

  // 5. User Filtering
  console.log('\n5. Testing Filter by Specific Roommate User...');
  {
    const rahulRes = await fetch(
      `${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity?userId=u1111111-1111-1111-1111-111111111111`,
      {
        headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
      }
    );
    const rahulBody = await rahulRes.json();
    assert(rahulRes.status === 200, 'GET /activity?userId=... returns 200');
    assert(rahulBody.activities.every((a: any) => a.userId === 'u1111111-1111-1111-1111-111111111111'), 'All items belong to specified user');
  }

  // 6. Security & Validation
  console.log('\n6. Testing Security & Validation...');
  {
    // Request without auth token
    const noAuthRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity`);
    assert(noAuthRes.status === 401, 'Request without token rejected with 401 Unauthorized');

    // Non-existent roomId
    const badRoomRes = await fetch(`${API_BASE}/api/rooms/r9999999-9999-9999-9999-999999999999/activity`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(badRoomRes.status === 404, 'Non-existent roomId returns 404 Not Found');

    // Non-existent activity ID
    const notFoundRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity/act-non-existent-999`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(notFoundRes.status === 404, 'Non-existent activity ID returns 404 Not Found');
  }

  console.log(`\n========================================`);
  console.log(`Phase 18 API Tests Complete: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runActivityApiTests().catch((err) => {
  console.error('Fatal error running activity API tests:', err);
  process.exit(1);
});
