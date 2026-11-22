const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline'; // Admin & Collector
const AMAN_TOKEN = 'pg_mock_token_offline_aman'; // Member
const OCT_SETTLEMENT_ID = 'set-2026-10-flat302';

async function runTests() {
  console.log('🧪 Starting Phase 12: Payment Management API Tests...\n');
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
    // 1. GET Payments List
    console.log('1. Testing Payments & Landlord Payments Listing...');
    const listRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /payments returns 200');
    assert(Array.isArray(listData.payments) && listData.payments.length >= 4, 'Returns roommate payments array');
    assert(Array.isArray(listData.landlordPayments) && listData.landlordPayments.length >= 1, 'Returns landlord payments array');

    // 2. Mark Payment Sent (Aman -> Collector)
    console.log('\n2. Testing Mark Payment Sent...');
    const idemKeyAman = `idem-test-${Date.now()}`;
    const sendRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        settlementId: OCT_SETTLEMENT_ID,
        amountPaise: 790000, // ₹7,900
        method: 'upi',
        idempotencyKey: idemKeyAman,
      }),
    });
    const sendData = await sendRes.json();
    assert(sendRes.status === 201, 'POST /payments returns 201 Created');
    assert(sendData.payment.status === 'sent', 'Roommate payment status is initially sent (awaiting confirmation)');
    assert(sendData.payment.payerName === 'Aman Verma', 'Payer name recorded correctly');
    const paymentIdAman = sendData.payment.id;

    // Idempotency check: sending same key again
    const dupRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        settlementId: OCT_SETTLEMENT_ID,
        amountPaise: 790000,
        method: 'upi',
        idempotencyKey: idemKeyAman,
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 200 && dupData.idempotent === true, 'Duplicate idempotency key safely returns existing payment');

    // 3. Collector Confirms Payment
    console.log('\n3. Testing Collector Confirmation...');
    const confirmRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments/${paymentIdAman}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` }, // Rahul is Collector
    });
    const confirmData = await confirmRes.json();
    assert(confirmRes.status === 200, 'POST /payments/:id/confirm returns 200');
    assert(confirmData.payment.status === 'confirmed', 'Payment status updated to confirmed');
    assert(!!confirmData.payment.confirmedAt, 'confirmedAt timestamp set');

    // 4. Collector's Own Payment Auto-Confirmed
    console.log('\n4. Testing Collector Auto-Confirmation...');
    const rahulPayRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        settlementId: OCT_SETTLEMENT_ID,
        amountPaise: 430000, // ₹4,300
        method: 'upi',
        idempotencyKey: `idem-rahul-${Date.now()}`,
      }),
    });
    const rahulPayData = await rahulPayRes.json();
    assert(rahulPayData.payment.status === 'confirmed', 'Collector own payment is auto-confirmed immediately');

    // 5. Cancel Sent Payment before Confirmation
    console.log('\n5. Testing Payment Cancellation...');
    const sendCancelRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`,
      },
      body: JSON.stringify({
        settlementId: OCT_SETTLEMENT_ID,
        amountPaise: 790000,
        method: 'cash',
        idempotencyKey: `idem-cancel-${Date.now()}`,
      }),
    });
    const sendCancelData = await sendCancelRes.json();
    const cancelPayId = sendCancelData.payment.id;

    const cancelRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments/${cancelPayId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, 'POST /payments/:id/cancel returns 200');
    assert(cancelData.payment.status === 'cancelled', 'Status updated to cancelled');

    // 6. Reverse Confirmed Payment
    console.log('\n6. Testing Payment Reversal by Collector...');
    const reverseRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments/${paymentIdAman}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`, // Collector
      },
      body: JSON.stringify({ reason: 'Bank transaction bounced after initial receipt' }),
    });
    const reverseData = await reverseRes.json();
    assert(reverseRes.status === 200, 'POST /payments/:id/reverse returns 200');
    assert(reverseData.payment.status === 'reversed', 'Payment status updated to reversed');
    assert(reverseData.payment.reversalReason === 'Bank transaction bounced after initial receipt', 'Reversal reason recorded');

    // 7. Record Landlord Payment
    console.log('\n7. Testing Landlord Payout Recording...');
    const lpRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/landlord-payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        settlementId: OCT_SETTLEMENT_ID,
        amountPaise: 2800000, // ₹28,000 full flat rent
        method: 'upi',
      }),
    });
    const lpData = await lpRes.json();
    assert(lpRes.status === 201, 'POST /landlord-payments returns 201 Created');
    assert(lpData.landlordPayment.amountPaise === 2800000, 'Landlord rent payout matches ₹28,000');

    // 8. Access Control & Validation
    console.log('\n8. Testing Permissions & Validation...');
    // Aman (non-collector) cannot confirm payments
    const forbiddenConfirmRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments/${paymentIdAman}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AMAN_TOKEN}` },
    });
    assert(forbiddenConfirmRes.status === 403, 'Non-collector cannot confirm payment (403 Forbidden)');

    // Reversal without reason rejected
    const badReverseRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/payments/${paymentIdAman}/reverse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({ reason: '' }), // Invalid empty reason
    });
    assert(badReverseRes.status === 400, 'Reversal without reason rejected with 400');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Phase 12 API Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
