const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline';
const AMAN_TOKEN = 'pg_mock_token_offline_aman';

async function runTests() {
  console.log('🧪 Starting Phase 16: Push Notifications API Tests...\n');
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
    // 0. Ensure Room Notifications are Enabled at start
    await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ notificationsEnabled: true }),
    });

    // 1. Register Push Token
    console.log('1. Testing Push Token Registration...');
    const registerRes = await fetch(`${API_BASE}/api/notifications/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        token: 'ExponentPushToken[test-rahul-device-token-12345]',
      }),
    });
    const registerData = await registerRes.json();
    assert(registerRes.status === 200, 'POST /notifications/token returns 200');
    assert(registerData.success === true, 'Token registration success is true');
    assert(
      registerData.token === 'ExponentPushToken[test-rahul-device-token-12345]',
      'Token value correctly recorded'
    );

    // 2. Retrieve Push Token
    console.log('\n2. Testing Push Token Retrieval...');
    const getRes = await fetch(`${API_BASE}/api/notifications/token`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const getData = await getRes.json();
    assert(getRes.status === 200, 'GET /notifications/token returns 200');
    assert(
      getData.token === 'ExponentPushToken[test-rahul-device-token-12345]',
      'Retrieved token matches registered token'
    );

    // 3. Validation & Security
    console.log('\n3. Testing Token Validation & Auth...');
    const invalidRes = await fetch(`${API_BASE}/api/notifications/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ token: '' }),
    });
    assert(invalidRes.status === 400, 'Empty token rejected with 400 Bad Request');

    const unauthRes = await fetch(`${API_BASE}/api/notifications/token`, {
      headers: { Authorization: 'Bearer bad_token' },
    });
    assert(unauthRes.status === 401, 'Unauthorized request rejected with 401');

    // 4. Test All 7 Event Types
    console.log('\n4. Testing All 7 Notification Event Types...');
    const eventTypes: Array<{ type: string; label: string; expectedUrl: string }> = [
      { type: 'expense_created', label: '1. Expense Created', expectedUrl: '/(tabs)/expenses' },
      { type: 'expense_updated', label: '2. Expense Updated', expectedUrl: '/(tabs)/expenses' },
      { type: 'expense_deleted', label: '3. Expense Deleted', expectedUrl: '/(tabs)/expenses' },
      { type: 'settlement_finalized', label: '4. Settlement Finalized', expectedUrl: '/statement-detail' },
      { type: 'payment_sent', label: '5. Payment Sent', expectedUrl: '/collector-confirmations' },
      { type: 'payment_confirmed', label: '6. Payment Confirmed', expectedUrl: '/payment-history' },
      { type: 'payment_reversed', label: '7. Payment Reversed', expectedUrl: '/payment-history' },
    ];

    for (const evt of eventTypes) {
      const res = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RAHUL_TOKEN}`,
        },
        body: JSON.stringify({ eventType: evt.type }),
      });
      const data = await res.json();
      assert(res.status === 200, `${evt.label} dispatches with 200 OK`);
      assert(data.success === true, `${evt.label} reports success`);
      assert(data.suppressed === false, `${evt.label} is not suppressed`);
      assert(data.notifications.length > 0, `${evt.label} generated recipient notifications`);
      assert(
        data.notifications[0].data.url === evt.expectedUrl,
        `${evt.label} contains deep link url: ${evt.expectedUrl}`
      );
    }

    // 5. Test Room Notification Toggle (Admin Controls)
    console.log('\n5. Testing Room Notification Toggle (OFF -> Suppressed, ON -> Resumed)...');
    
    // Disable notifications via room settings
    const toggleOffRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ notificationsEnabled: false }),
    });
    assert(toggleOffRes.status === 200, 'PATCH /rooms/:id disables notifications');

    // Attempt to send notification while disabled
    const suppressedRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ eventType: 'expense_created' }),
    });
    const suppressedData = await suppressedRes.json();
    assert(suppressedData.suppressed === true, 'Notification is marked as suppressed when toggle is OFF');
    assert(suppressedData.sentCount === 0, 'Zero push notifications sent when toggle is OFF');

    // Re-enable notifications
    const toggleOnRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ notificationsEnabled: true }),
    });
    assert(toggleOnRes.status === 200, 'PATCH /rooms/:id re-enables notifications');

    // Attempt to send notification after re-enabling
    const resumedRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/notifications/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ eventType: 'expense_created' }),
    });
    const resumedData = await resumedRes.json();
    assert(resumedData.suppressed === false, 'Notification resumes delivery when toggle is ON');
    assert(resumedData.sentCount > 0, 'Push notifications sent when toggle is ON');

    // 6. Test Notifications History Query
    console.log('\n6. Testing Notification History Retrieval...');
    const historyRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/notifications`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'GET /rooms/:id/notifications returns 200');
    assert(Array.isArray(historyData.notifications), 'Notifications returned as array');
    assert(historyData.notifications.length > 0, 'Contains sent notifications');
    assert(historyData.notificationsEnabled === true, 'Returns room notificationsEnabled status');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Phase 16 API Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
