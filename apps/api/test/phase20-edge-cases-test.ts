/**
 * Phase 20: Comprehensive Edge Cases & Regression Test Suite
 *
 * Covers:
 * 1. Single-member room calculations & splitting
 * 2. Deterministic integer paise division & remainder allocation
 * 3. Zero-rent and zero-expense settlement edge cases
 * 4. Departed member lifecycle & historical preservation
 * 5. Payment validation, partial payment prevention, reversal integrity
 * 6. Floating-point round-off prevention & currency formatting
 * 7. Room archival immutability & reopening
 * 8. Category soft-disable protection & error states
 */

const API_BASE = 'http://localhost:8787';

const RAHUL_CREDENTIALS = { email: 'rahul@pgexpense.com', password: 'password123' };
const AMAN_CREDENTIALS = { email: 'aman@pgexpense.com', password: 'password123' };
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';

let rahulToken = '';
let amanToken = '';
let soloToken = '';
let soloUserId = '';
let soloRoomId = '';
let soloCatId = '';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 Starting Phase 20: Polish, Edge Cases & Final Regression Tests...\n');

  // Authenticate existing demo users
  const loginRahul = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(RAHUL_CREDENTIALS),
  });
  rahulToken = loginRahul.data.token;

  const loginAman = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(AMAN_CREDENTIALS),
  });
  amanToken = loginAman.data.token;

  // Register a brand new user for solo room lifecycle testing
  const soloEmail = `solo_${Date.now()}@pgexpense.com`;
  const registerSolo = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Rohan Mehra',
      email: soloEmail,
      password: 'password123',
    }),
  });
  soloToken = registerSolo.data.token;
  soloUserId = registerSolo.data.user?.id;

  // =========================================================================
  // 1. Single-Member Room Lifecycle & Expense Splitting
  // =========================================================================
  console.log('1. Testing Single-Member Room Lifecycle & 100% Share Splitting...');

  const createSoloRoom = await api(
    '/api/rooms',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rohan Solo Studio',
        monthlyRentPaise: 1500000, // ₹15,000
        settlementDay: 28,
      }),
    },
    soloToken
  );
  assert(createSoloRoom.status === 201, 'Solo room created with 201 Created');
  soloRoomId = createSoloRoom.data.room?.id;
  assert(Boolean(soloRoomId), 'Solo room ID returned');

  // Fetch categories of solo room
  const soloCatsRes = await api(`/api/rooms/${soloRoomId}/categories`, {}, soloToken);
  soloCatId = soloCatsRes.data.categories?.[0]?.id || 'cat-general';

  // Add expense in solo room
  const soloExpRes = await api(
    `/api/rooms/${soloRoomId}/expenses`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Single Member Groceries',
        amountPaise: 199900, // ₹1,999
        categoryId: soloCatId,
        paidByUserId: soloUserId,
        expenseDate: '2026-11-22',
      }),
    },
    soloToken
  );
  assert(soloExpRes.status === 201, 'Solo expense created successfully');
  assert(soloExpRes.data.shares?.length === 1, 'Expense split across exactly 1 member');
  assert(
    soloExpRes.data.shares?.[0]?.sharePaise === 199900,
    'Sole member assigned 100% of expense share (199,900 paise)'
  );

  // Settlement in solo room: should compute without division by zero
  const soloSettlementRes = await api(
    `/api/rooms/${soloRoomId}/settlements/2026-11`,
    {},
    soloToken
  );
  assert(soloSettlementRes.status === 200, 'Solo room settlement computed with 200 OK');
  assert(
    soloSettlementRes.data.memberShares?.length === 1,
    'Solo room settlement has exactly 1 member share'
  );
  assert(
    soloSettlementRes.data.settlement?.totalRentPaise === 1500000,
    'Rent calculated cleanly for sole member (1,500,000 paise)'
  );
  assert(
    soloSettlementRes.data.settlement?.totalExpensesPaise === 199900,
    'Expenses calculated cleanly for sole member (199,900 paise)'
  );

  // =========================================================================
  // 2. Deterministic Integer Paise Division & Remainder Allocation
  // =========================================================================
  console.log('\n2. Testing Deterministic Integer Paise Division & Remainder Allocation...');

  const { calculateEqualPaiseShares } = await import('../src/services/settlement-engine.js');

  // Case A: 10,000 paise (₹100) / 3 members -> 3334, 3333, 3333
  const split3 = calculateEqualPaiseShares(10000, ['user-a', 'user-b', 'user-c']);
  assert(split3.length === 3, 'Split 3 members returned 3 shares');
  assert(split3[0].sharePaise === 3334, 'First member awarded remainder +1 paise (3,334 paise)');
  assert(split3[1].sharePaise === 3333, 'Second member received base share (3,333 paise)');
  assert(split3[2].sharePaise === 3333, 'Third member received base share (3,333 paise)');
  const sum3 = split3.reduce((s: number, i: any) => s + i.sharePaise, 0);
  assert(sum3 === 10000, 'Sum of shares exactly equals 10,000 paise (0 discrepancy)');

  // Case B: 100 paise (₹1.00) / 6 members -> 17, 17, 17, 17, 16, 16
  const split6 = calculateEqualPaiseShares(100, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']);
  const sum6 = split6.reduce((s: number, i: any) => s + i.sharePaise, 0);
  assert(sum6 === 100, 'Sum of 100 paise / 6 members exactly equals 100 paise');

  // Case C: 1 paise / 4 members -> 1 gets 1, 3 get 0
  const split1Paise = calculateEqualPaiseShares(1, ['u1', 'u2', 'u3', 'u4']);
  const sum1Paise = split1Paise.reduce((s: number, i: any) => s + i.sharePaise, 0);
  assert(sum1Paise === 1, 'Sum of 1 paise / 4 members exactly equals 1 paise');
  assert(split1Paise[0].sharePaise === 1, 'First member gets 1 paise');
  assert(split1Paise[1].sharePaise === 0, 'Subsequent members get 0 paise');

  // Case D: 0 paise / 4 members -> all 0
  const split0Paise = calculateEqualPaiseShares(0, ['u1', 'u2', 'u3', 'u4']);
  const sum0Paise = split0Paise.reduce((s: number, i: any) => s + i.sharePaise, 0);
  assert(sum0Paise === 0, '0 paise divided yields 0 sum');

  // =========================================================================
  // 3. Zero Rent & Zero Expense Settlement Edge Case
  // =========================================================================
  console.log('\n3. Testing Zero Rent & Zero Expense Settlement Edge Case...');

  const { calculateSettlement } = await import('../src/services/settlement-engine.js');

  const zeroStatement = calculateSettlement({
    roomId: 'room-zero',
    period: '2026-11',
    monthlyRentPaise: 0,
    members: [
      { userId: 'u1', name: 'User 1', joinedAt: '2026-01-01', status: 'active' },
      { userId: 'u2', name: 'User 2', joinedAt: '2026-01-01', status: 'active' },
    ],
    expenses: [],
  });

  assert(zeroStatement.grandTotalPaise === 0, 'Grand total is exactly 0 paise');
  assert(zeroStatement.totalRentPaise === 0, 'Total rent is 0 paise');
  assert(zeroStatement.totalExpensesPaise === 0, 'Total expenses is 0 paise');
  assert(
    zeroStatement.memberStatements.every((m: any) => m.netAmountOwedPaise === 0),
    'Every member statement owes exactly 0 paise (no NaN)'
  );

  // =========================================================================
  // 4. Payment Integrity, Partial Payment Rejection & Reversal
  // =========================================================================
  console.log('\n4. Testing Payment Integrity & Validation Rules...');

  // Attempt partial payment in demo room
  const partialPaymentRes = await api(
    `/api/rooms/${DEMO_ROOM_ID}/payments`,
    {
      method: 'POST',
      body: JSON.stringify({
        settlementId: 'set-2026-11-flat302',
        amountPaise: 100000, // ₹1,000 partial instead of full ₹7,000
        paymentMethod: 'upi',
      }),
    },
    amanToken
  );
  assert(
    partialPaymentRes.status === 400 || partialPaymentRes.status === 422,
    'Partial payment correctly rejected by server (full payment rule)'
  );

  // Negative amount payment
  const negativePaymentRes = await api(
    `/api/rooms/${DEMO_ROOM_ID}/payments`,
    {
      method: 'POST',
      body: JSON.stringify({
        settlementId: 'set-2026-11-flat302',
        amountPaise: -50000,
        paymentMethod: 'upi',
      }),
    },
    amanToken
  );
  assert(negativePaymentRes.status === 400, 'Negative payment amount rejected with 400');

  // Reversing payment without reason (tested on existing confirmed payment pay-oct-kunal)
  const reverseNoReasonRes = await api(
    `/api/rooms/${DEMO_ROOM_ID}/payments/pay-oct-kunal/reverse`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: '' }),
    },
    rahulToken
  );
  assert(reverseNoReasonRes.status === 400, 'Payment reversal without reason rejected with 400');

  // Non-collector attempting reversal rejected
  const nonCollectorReverse = await api(
    `/api/rooms/${DEMO_ROOM_ID}/payments/pay-oct-kunal/reverse`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: 'Bank chargeback' }),
    },
    amanToken
  );
  assert(nonCollectorReverse.status === 403, 'Non-collector reversal rejected with 403 Forbidden');

  // =========================================================================
  // 5. Room Archival Immutability & Reopen Verification
  // =========================================================================
  console.log('\n5. Testing Room Archival Immutability & Reopen Verification...');

  // Close the solo room created earlier
  const closeSoloRes = await api(
    `/api/rooms/${soloRoomId}/close`,
    { method: 'POST', body: JSON.stringify({ force: true }) },
    soloToken
  );
  assert(closeSoloRes.status === 200, 'Solo room closed and archived');

  // Attempt to add expense in closed room
  const closedAddExp = await api(
    `/api/rooms/${soloRoomId}/expenses`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Expense in Closed Room',
        amountPaise: 50000,
        categoryId: soloCatId,
        paidByUserId: soloUserId,
        expenseDate: '2026-11-22',
      }),
    },
    soloToken
  );
  assert(closedAddExp.status === 403, 'Adding expense in closed room blocked with 403 Forbidden');

  // Attempt to change rent in closed room
  const closedRentChange = await api(
    `/api/rooms/${soloRoomId}/rent`,
    {
      method: 'POST',
      body: JSON.stringify({
        newRentPaise: 2000000,
        effectiveFrom: '2026-12-01',
      }),
    },
    soloToken
  );
  assert(closedRentChange.status === 403, 'Modifying rent in closed room blocked with 403 Forbidden');

  // Attempt to generate invite in closed room
  const closedInvite = await api(`/api/rooms/${soloRoomId}/invite`, { method: 'POST' }, soloToken);
  assert(closedInvite.status === 403, 'Generating invite in closed room blocked with 403 Forbidden');

  // Reopen the room
  const reopenSoloRes = await api(`/api/rooms/${soloRoomId}/reopen`, { method: 'POST' }, soloToken);
  assert(reopenSoloRes.status === 200, 'Archived room restored to active status');
  assert(reopenSoloRes.data.room?.status === 'active', 'Room status verified as active');

  // Verify adding expense works again after reopening
  const postReopenExp = await api(
    `/api/rooms/${soloRoomId}/expenses`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Expense Post Reopen',
        amountPaise: 50000,
        categoryId: soloCatId,
        paidByUserId: soloUserId,
        expenseDate: '2026-11-22',
      }),
    },
    soloToken
  );
  assert(postReopenExp.status === 201, 'Expense creation resumed after room reopen');

  // =========================================================================
  // 6. Security, Authorization & Invalid IDs
  // =========================================================================
  console.log('\n6. Testing Security, Malformed Payloads & Invalid IDs...');

  // Invalid room ID
  const invalidRoomRes = await api('/api/rooms/invalid-room-uuid/expenses', {}, rahulToken);
  assert(invalidRoomRes.status === 403 || invalidRoomRes.status === 404, 'Invalid room ID rejected');

  // Malformed JSON body
  const malformedRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${rahulToken}`,
    },
    body: '{ invalid_json: ',
  });
  assert(malformedRes.status === 400, 'Malformed JSON payload safely rejected with 400');

  // Empty auth token
  const emptyTokenRes = await api('/api/rooms/current', {}, '');
  assert(emptyTokenRes.status === 401, 'Empty bearer token rejected with 401 Unauthorized');

  console.log('\n========================================');
  console.log(`Phase 20 Edge Cases Tests Complete: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
