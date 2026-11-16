declare const process: any;
import { authService, AuthenticationError, MembershipStatusError } from '../services/authService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('   HIMS AUTHENTICATION TEST SUITE');
  console.log('========================================\n');

  authService.resetMockData();

  // ----------------------------------------------------
  // PART A: LOGIN TESTS
  // ----------------------------------------------------
  console.log('--- 1. LOGIN TESTS ---');

  // Test 1: Empty credentials validation
  try {
    await authService.login({ username: '', password: '' });
    assert(false, 'Empty username and password should be rejected');
  } catch (err: any) {
    assert(err instanceof AuthenticationError, 'Empty credentials rejected with AuthenticationError');
  }

  // Test 2: Valid credentials login
  try {
    const res = await authService.login({
      username: 'sarah.almansoor',
      password: 'Doctor@123',
    });
    assert(Boolean(res.session && res.session.user.username === 'sarah.almansoor'), 'Active doctor can log in successfully');
    assert(res.session?.activeMembership.role === 'doctor', 'Active session has doctor role');
  } catch (err: any) {
    assert(false, `Active doctor login failed: ${err.message}`);
  }

  // Test 3: Case-insensitive login (uppercase/mixed)
  try {
    const res = await authService.login({
      username: 'SaRaH.AlMaNsOoR',
      password: 'Doctor@123',
    });
    assert(Boolean(res.session), 'Login succeeds with mixed-case username (case-insensitive)');
  } catch (err: any) {
    assert(false, `Case-insensitive login failed: ${err.message}`);
  }

  // Test 4: Leading/trailing whitespace in username
  try {
    const res = await authService.login({
      username: '   sarah.almansoor   ',
      password: 'Doctor@123',
    });
    assert(Boolean(res.session), 'Login handles leading/trailing whitespace correctly');
  } catch (err: any) {
    assert(false, `Whitespace login failed: ${err.message}`);
  }

  // Test 4b: Login using official email instead of username
  try {
    const res = await authService.login({
      username: 'sarah.almansoor@stjude.org',
      password: 'Doctor@123',
    });
    assert(Boolean(res.session && res.session.user.email === 'sarah.almansoor@stjude.org'), 'Login succeeds with official email address');
  } catch (err: any) {
    assert(false, `Official email login failed: ${err.message}`);
  }

  // Test 5: Invalid password rejected
  try {
    await authService.login({
      username: 'sarah.almansoor',
      password: 'WrongPassword!999',
    });
    assert(false, 'Invalid password should be rejected');
  } catch (err: any) {
    assert(err.message === 'Invalid username or password.', 'Invalid password returns generic secure message');
  }

  // Test 6: Non-existent username rejected
  try {
    await authService.login({
      username: 'ghost.user.999',
      password: 'AnyPassword@123',
    });
    assert(false, 'Non-existent username should be rejected');
  } catch (err: any) {
    assert(err.message === 'Invalid username or password.', 'Non-existent username returns generic secure message');
  }

  // Test 7: PENDING membership denied operational access (Requirement Part A & H)
  try {
    await authService.login({
      username: 'priya.pending',
      password: 'Priya@123',
    });
    assert(false, 'Pending membership must NOT be granted operational access');
  } catch (err: any) {
    assert(
      err instanceof MembershipStatusError && err.status === 'pending',
      'Pending membership denied operational access with MembershipStatusError (status: pending)'
    );
  }

  // Test 8: SUSPENDED membership denied operational access
  try {
    await authService.login({
      username: 'vikram.suspended',
      password: 'Vikram@123',
    });
    assert(false, 'Suspended membership must NOT be granted access');
  } catch (err: any) {
    assert(
      err instanceof MembershipStatusError && err.status === 'suspended',
      'Suspended membership denied operational access (status: suspended)'
    );
  }

  // Test 9: TERMINATED membership denied operational access
  try {
    await authService.login({
      username: 'anita.terminated',
      password: 'Anita@123',
    });
    assert(false, 'Terminated membership must NOT be granted access');
  } catch (err: any) {
    assert(
      err instanceof MembershipStatusError && err.status === 'terminated',
      'Terminated membership denied operational access (status: terminated)'
    );
  }

  // Test 10: Multi-hospital employee login prompts workspace selection
  try {
    const res = await authService.login({
      username: 'rahul',
      password: 'Rahul@123',
    });
    assert(
      Boolean(res.requiresWorkspaceSelection && res.availableMemberships && res.availableMemberships.length === 2),
      'Multi-hospital user triggers workspace selection with 2 available hospital memberships'
    );

    // Test workspace selection
    const session = await authService.selectWorkspace(res.user!.id, 'hosp-stjude');
    assert(session.activeMembership.hospitalUid === 'STJUDE-METRO-01', 'Workspace selected correctly as St. Jude');
  } catch (err: any) {
    assert(false, `Multi-hospital login failed: ${err.message}`);
  }

  // ----------------------------------------------------
  // PART B: USERNAME ARCHITECTURE TESTS
  // ----------------------------------------------------
  console.log('\n--- 2. USERNAME ARCHITECTURE TESTS ---');

  // Test 11: Format validation - too short
  const shortVal = authService.validateUsernameFormat('ab');
  assert(!shortVal.valid && Boolean(shortVal.error), 'Username < 3 chars rejected');

  // Test 12: Format validation - special characters
  const charVal = authService.validateUsernameFormat('rahul@hospital');
  assert(!charVal.valid && Boolean(charVal.error), "Special character '@' rejected in username");

  // Test 13: Format validation - period at start/end
  const periodVal = authService.validateUsernameFormat('.rahul');
  assert(!periodVal.valid && Boolean(periodVal.error), 'Username starting with period rejected');

  // Test 14: Format validation - valid allowed characters
  const validVal = authService.validateUsernameFormat('rahul.med_01');
  assert(validVal.valid, "Valid characters ('letters', 'numbers', '.', '_') accepted");

  // Test 15: Global case-insensitive availability check
  const availExact = await authService.checkUsernameAvailability('sarah.almansoor');
  assert(!availExact.available, 'Exact existing username rejected as unavailable');

  const availUpper = await authService.checkUsernameAvailability('SARAH.ALMANSOOR');
  assert(!availUpper.available, 'UPPERCASE existing username rejected as unavailable (case-insensitive)');

  const availNew = await authService.checkUsernameAvailability('rajiv.new.doc');
  assert(availNew.available, 'New unused username accepted as available');

  // ----------------------------------------------------
  // PART C: REGISTRATION TESTS
  // ----------------------------------------------------
  console.log('\n--- 3. REGISTRATION TESTS ---');

  // Test 16: Invalid Hospital UID rejected
  try {
    await authService.register({
      hospitalUid: 'FAKE-HOSPITAL-99',
      employeeUid: 'EMP-DOC-303',
      username: 'rajiv.sharma',
      email: 'rajiv@stjude.org',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      requestedDepartment: 'General Medicine',
      requestedRole: 'doctor',
    });
    assert(false, 'Invalid hospital UID should be rejected');
  } catch (err: any) {
    assert(err.message.includes('not found in the HIMS registry'), 'Invalid Hospital UID rejected with clear message');
  }

  // Test 17: Invalid Employee UID rejected
  try {
    await authService.register({
      hospitalUid: 'STJUDE-METRO-01',
      employeeUid: 'EMP-FAKE-999',
      username: 'rajiv.sharma',
      email: 'rajiv@stjude.org',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      requestedDepartment: 'General Medicine',
      requestedRole: 'doctor',
    });
    assert(false, 'Invalid Employee UID should be rejected');
  } catch (err: any) {
    assert(err.message.includes('not recognized in the official employee directory'), 'Invalid Employee UID rejected');
  }

  // Test 18: Already registered Employee UID rejected
  try {
    await authService.register({
      hospitalUid: 'STJUDE-METRO-01',
      employeeUid: 'EMP-DOC-101', // Dr. Sarah (already registered)
      username: 'new.sarah',
      email: 'sarah2@stjude.org',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      requestedDepartment: 'General Medicine',
      requestedRole: 'doctor',
    });
    assert(false, 'Already registered employee UID should be rejected');
  } catch (err: any) {
    assert(err.message.includes('already registered on HIMS'), 'Already registered employee rejected');
  }

  // Test 19: Password confirmation mismatch rejected
  try {
    await authService.register({
      hospitalUid: 'STJUDE-METRO-01',
      employeeUid: 'EMP-DOC-303',
      username: 'rajiv.sharma',
      email: 'rajiv@stjude.org',
      password: 'Password@123',
      confirmPassword: 'MismatchedPassword@123',
      requestedDepartment: 'General Medicine',
      requestedRole: 'doctor',
    });
    assert(false, 'Password confirmation mismatch should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Passwords do not match'), 'Password mismatch rejected');
  }

  // Test 20: Successful new employee registration (creates PENDING account)
  try {
    const regResult = await authService.register({
      hospitalUid: 'STJUDE-METRO-01',
      employeeUid: 'EMP-DOC-303', // Dr. Rajiv Sharma (unregistered in mock directory)
      username: 'rajiv.sharma',
      email: 'rajiv.sharma@stjude.org',
      password: 'RajivPassword@123',
      confirmPassword: 'RajivPassword@123',
      requestedDepartment: 'General Medicine',
      requestedRole: 'doctor',
    });

    assert(Boolean(regResult.user && regResult.membership), 'Registration successfully creates user and membership');
    assert(regResult.membership.status === 'pending', 'Newly registered membership status is strictly PENDING');
    assert(!regResult.membership.departmentHeadApproved, 'Department Head approval is initially FALSE');
    assert(!regResult.membership.adminApproved, 'Administrator approval is initially FALSE');

    // Test 21: Verify newly registered pending account CANNOT log into operational dashboard
    try {
      await authService.login({
        username: 'rajiv.sharma',
        password: 'RajivPassword@123',
      });
      assert(false, 'Newly registered pending account must NOT be granted operational access');
    } catch (loginErr: any) {
      assert(
        loginErr instanceof MembershipStatusError && loginErr.status === 'pending',
        'Newly registered pending account blocked from login with MembershipStatusError'
      );
    }
  } catch (err: any) {
    assert(false, `Registration failed: ${err.message}`);
  }

  // Test 22: Duplicate username registration attempt rejected
  try {
    await authService.register({
      hospitalUid: 'STJUDE-METRO-01',
      employeeUid: 'EMP-NUR-404',
      username: 'rajiv.sharma', // Already registered in previous test!
      email: 'maya@stjude.org',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      requestedDepartment: 'General Medicine',
      requestedRole: 'receptionist',
    });
    assert(false, 'Duplicate username registration must be rejected');
  } catch (err: any) {
    assert(err.message.includes('already registered'), 'Duplicate username registration rejected');
  }

  // Test 23: Cross-hospital global username collision check
  // An employee at Apollo cannot register 'rajiv.sharma' either!
  try {
    await authService.register({
      hospitalUid: 'APOLLO-CARE-02',
      employeeUid: 'EMP-REC-606', // David Miller at Apollo
      username: 'rajiv.sharma', // Registered at St. Jude
      email: 'david@apollo.org',
      password: 'Password@123',
      confirmPassword: 'Password@123',
      requestedDepartment: 'Outpatient Services',
      requestedRole: 'receptionist',
    });
    assert(false, 'Different hospital registering same username must be rejected');
  } catch (err: any) {
    assert(err.message.includes('already registered'), 'Global username collision prevented across different hospitals');
  }

  // ----------------------------------------------------
  // PART D: PASSWORD RECOVERY TESTS
  // ----------------------------------------------------
  console.log('\n--- 4. PASSWORD RECOVERY TESTS ---');

  // Test 24: Recovery with empty identifier rejected
  try {
    await authService.requestPasswordReset('');
    assert(false, 'Empty identifier should be rejected');
  } catch (err: any) {
    assert(err instanceof AuthenticationError, 'Empty recovery identifier rejected');
  }

  // Test 25: Recovery for existing user returns generic safe message
  const resetExisting = await authService.requestPasswordReset('sarah.almansoor');
  assert(
    resetExisting.success && resetExisting.message.includes('If an account with that username or email exists'),
    'Password recovery returns generic safe message for existing user'
  );

  // Test 26: Recovery for non-existent user returns EXACT same message (no account enumeration!)
  const resetNonExistent = await authService.requestPasswordReset('ghost.nonexistent.user');
  assert(
    resetNonExistent.success && resetNonExistent.message === resetExisting.message,
    'Non-existent account receives identical response preventing user enumeration'
  );

  console.log('\n========================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

