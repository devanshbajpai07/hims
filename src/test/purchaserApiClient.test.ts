declare const process: any;
import { purchaserApiClient } from '../services/purchaserApiClient';

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

async function runPurchaserApiClientTests() {
  console.log('\n========================================');
  console.log('   HIMS PURCHASER API CLIENT TEST SUITE');
  console.log('========================================\n');

  // Test 1: CSRF Token Management
  console.log('--- 1. CSRF MANAGEMENT ---');
  purchaserApiClient.setCsrfToken('test-csrf-token-abc123xyz');
  assert(purchaserApiClient.getCsrfToken() === 'test-csrf-token-abc123xyz', 'setCsrfToken stores token and getCsrfToken returns it');

  // Test 2: Initial Cached Purchaser State
  console.log('\n--- 2. CACHED PURCHASER STATE ---');
  assert(purchaserApiClient.getCachedPurchaser() === null, 'Initial cached purchaser is null');

  // Test 3: Mock Global Fetch for API Client Testing
  console.log('\n--- 3. CLIENT NETWORK & SERIALIZATION TESTS ---');
  const originalFetch = globalThis.fetch;

  try {
    // 3a. Register serialization
    let lastUrl = '';
    let lastOptions: any = undefined;

    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
      lastUrl = url.toString();
      lastOptions = options;
      return {
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          purchaser_id: 'purch-123',
          email: 'test@example.com',
          message: 'Account registered successfully.',
          dev_otp: '654321',
        }),
      } as Response;
    }) as any;

    const regRes = await purchaserApiClient.register({
      fullName: 'Dr. Jane Smith',
      email: 'Jane.Smith@hospital.org',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
    });

    assert(lastUrl === '/api/v1/purchaser/auth/register', 'Register hits /api/v1/purchaser/auth/register');
    assert(lastOptions?.method === 'POST', 'Register uses POST method');
    assert(lastOptions?.credentials === 'include', 'Register includes credentials for cookie auth');
    const sentBody = JSON.parse(lastOptions?.body as string);
    assert(sentBody.full_name === 'Dr. Jane Smith', 'Register payload serializes full_name correctly');
    assert(sentBody.email === 'Jane.Smith@hospital.org', 'Register payload serializes email');
    assert(regRes.dev_otp === '654321', 'Register returns dev_otp');

    // 3b. Verify Email
    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
      lastUrl = url.toString();
      lastOptions = options;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          purchaser: {
            id: 'purch-123',
            full_name: 'Dr. Jane Smith',
            email: 'jane.smith@hospital.org',
            is_email_verified: true,
            account_status: 'active',
            created_at: new Date().toISOString(),
            last_login_at: null,
          },
          csrf_token: 'new-session-csrf-456',
          message: 'Email successfully verified.',
        }),
      } as Response;
    }) as any;

    const verifyRes = await purchaserApiClient.verifyEmail({
      email: 'jane.smith@hospital.org',
      otp: '654321',
    });

    assert(lastUrl === '/api/v1/purchaser/auth/verify-email', 'Verify hits /api/v1/purchaser/auth/verify-email');
    assert(verifyRes.purchaser.is_email_verified === true, 'Verify returns verified profile');
    assert(purchaserApiClient.getCsrfToken() === 'new-session-csrf-456', 'Verify updates CSRF token');
    assert(purchaserApiClient.getCachedPurchaser()?.fullName === 'Dr. Jane Smith', 'Cached purchaser profile updated');

    // 3c. Automatic CSRF Injection on subsequent POST
    globalThis.fetch = (async (url: string | URL | Request, options?: RequestInit) => {
      lastUrl = url.toString();
      lastOptions = options;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Password changed successfully.' }),
      } as Response;
    }) as any;

    await purchaserApiClient.changePassword('OldPass123!', 'NewPass123!', 'NewPass123!');
    const headers = lastOptions?.headers as Record<string, string>;
    assert(headers?.['X-CSRF-Token'] === 'new-session-csrf-456', 'Automatic CSRF header injected on state-changing request');

    // 3d. Error Handling with 403 / 422
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          detail: 'Email address has not been verified yet.',
          code: 'PURCHASER_EMAIL_UNVERIFIED',
        }),
      } as Response;
    }) as any;

    let caughtError: any = null;
    try {
      await purchaserApiClient.login({
        email: 'unverified@hospital.org',
        password: 'Password123!',
      });
    } catch (err: any) {
      caughtError = err;
    }

    assert(caughtError !== null, 'Client throws error on non-ok HTTP response');
    assert(caughtError.status === 403, 'Error preserves HTTP status code 403');
    assert(caughtError.code === 'PURCHASER_EMAIL_UNVERIFIED', 'Error preserves backend machine-readable error code');
    assert(caughtError.message === 'Email address has not been verified yet.', 'Error preserves human-readable error detail');

    // 3e. Logout clears cache & CSRF
    globalThis.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Logged out successfully.' }),
      } as Response;
    }) as any;

    await purchaserApiClient.logout();
    assert(purchaserApiClient.getCachedPurchaser() === null, 'Logout clears cached purchaser');
    assert(purchaserApiClient.getCsrfToken() === null, 'Logout clears stored CSRF token');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('\n========================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================\n');

  if (failed > 0 && typeof process !== 'undefined') {
    process.exit(1);
  }
}

runPurchaserApiClientTests().catch((err) => {
  console.error('Test execution error:', err);
  if (typeof process !== 'undefined') {
    process.exit(1);
  }
});
