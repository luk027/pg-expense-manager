const API_BASE = 'http://localhost:8787';
const DEMO_ROOM_ID = 'r3023023-3023-3023-3023-302330233023';
const RAHUL_TOKEN = 'pg_mock_token_offline';
const AMAN_TOKEN = 'pg_mock_token_offline_aman';
const RAHUL_ID = 'u1111111-1111-1111-1111-111111111111';

async function runTests() {
  console.log('🧪 Starting Phase 7: Expense Management API Tests...\n');
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
    // 1. GET Room Categories
    console.log('1. Testing Categories List...');
    const catRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const catData = await catRes.json();
    assert(catRes.status === 200, 'GET /categories returns 200');
    assert(Array.isArray(catData.categories) && catData.categories.length >= 9, 'Default categories exist (Rent, Wi-Fi, etc.)');
    const rentCat = catData.categories.find((c: any) => c.name === 'Rent');
    assert(!!rentCat, 'Found Rent category');

    // 2. GET Room Expenses
    console.log('\n2. Testing Expense Listing & Filters...');
    const listRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /expenses returns 200');
    assert(Array.isArray(listData.expenses) && listData.expenses.length >= 5, 'Pre-seeded demo expenses returned');
    assert(listData.totalAmountPaise > 0, `Total expense amount in paise is calculated (${listData.totalAmountPaise})`);

    // 3. Filter by period
    const novFilterRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses?period=2026-11`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const novData = await novFilterRes.json();
    assert(novFilterRes.status === 200, 'GET /expenses?period=2026-11 returns 200');
    assert(novData.expenses.every((e: any) => e.expensePeriod === '2026-11'), 'All filtered expenses belong to 2026-11 period');

    // 4. POST Create New Expense
    console.log('\n3. Testing Add Expense with Auto-Split...');
    const createRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        name: 'Society Maintenance Diwali Fund',
        amountPaise: 120000, // ₹1,200
        categoryId: rentCat.id,
        paidByUserId: RAHUL_ID,
        expenseDate: '2026-11-20',
        settlementPreference: 'monthly',
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, 'POST /expenses returns 201 Created');
    assert(createData.success === true, 'Expense created flag is true');
    assert(createData.shares && createData.shares.length === 4, 'Split across 4 active room members');
    const shareSum = createData.shares.reduce((sum: number, s: any) => sum + s.sharePaise, 0);
    assert(shareSum === 120000, 'Sum of shares matches total expense (120,000 paise = ₹1,200)');
    assert(createData.shares[0].sharePaise === 30000, 'Each member share is exactly ₹300 (30,000 paise)');
    const createdExpenseId = createData.expense.id;

    // 5. GET Single Expense Details
    console.log('\n4. Testing GET Single Expense...');
    const singleRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses/${createdExpenseId}`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const singleData = await singleRes.json();
    assert(singleRes.status === 200, 'GET /expenses/:id returns 200');
    assert(singleData.expense.name === 'Society Maintenance Diwali Fund', 'Expense details matched');
    assert(singleData.shares.length === 4, 'Shares breakdown included in single view');

    // 6. PATCH Edit Expense
    console.log('\n5. Testing Edit Expense & Share Recalculation...');
    const updateRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses/${createdExpenseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        amountPaise: 140000, // Update to ₹1,400 (4 * 35,000 paise)
        name: 'Society Maintenance Diwali Fund (Updated)',
      }),
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'PATCH /expenses/:id returns 200');
    assert(updateData.expense.amountPaise === 140000, 'Amount updated to 140,000 paise');
    assert(updateData.shares[0].sharePaise === 35000, 'Shares recalculated to 35,000 paise each');

    // 7. DELETE Soft-Delete Expense
    console.log('\n6. Testing Soft-Delete...');
    const deleteRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses/${createdExpenseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    assert(deleteRes.status === 200, 'DELETE /expenses/:id returns 200');

    // Verify it is excluded from list
    const verifyListRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const verifyListData = await verifyListRes.json();
    const foundDeleted = verifyListData.expenses.find((e: any) => e.id === createdExpenseId);
    assert(!foundDeleted, 'Soft-deleted expense is excluded from active expenses list');

    // 8. Activity Log Verification
    console.log('\n7. Testing Activity Audit Trail...');
    const activityRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/activity`, {
      headers: { Authorization: `Bearer ${RAHUL_TOKEN}` },
    });
    const activityData = await activityRes.json();
    const hasCreateLog = activityData.logs.some((l: any) => l.action === 'expense_created');
    const hasUpdateLog = activityData.logs.some((l: any) => l.action === 'expense_updated');
    const hasDeleteLog = activityData.logs.some((l: any) => l.action === 'expense_deleted');
    assert(hasCreateLog, 'Audit log recorded expense_created event');
    assert(hasUpdateLog, 'Audit log recorded expense_updated event');
    assert(hasDeleteLog, 'Audit log recorded expense_deleted event');

    // 9. Validation & Access Control
    console.log('\n8. Testing Validation & Permissions...');
    const invalidRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RAHUL_TOKEN}`,
      },
      body: JSON.stringify({
        name: 'Negative expense',
        amountPaise: -500, // Invalid negative amount
        categoryId: rentCat.id,
        paidByUserId: RAHUL_ID,
        expenseDate: '2026-11-20',
      }),
    });
    assert(invalidRes.status === 400, 'Negative amount rejected with 400 Validation Error');

    const unauthorizedRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/expenses`, {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    assert(unauthorizedRes.status === 401, 'Invalid session token rejected with 401 Unauthorized');

    // Non-admin cannot create category
    const nonAdminCatRes = await fetch(`${API_BASE}/api/rooms/${DEMO_ROOM_ID}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AMAN_TOKEN}`, // Aman is member, not admin
      },
      body: JSON.stringify({ name: 'Secret Category' }),
    });
    assert(nonAdminCatRes.status === 403, 'Non-admin member cannot create category (403 Forbidden)');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Phase 7 Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
