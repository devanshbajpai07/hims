declare const process: any;
import { purchaserService } from '../services/purchaserService';
import { SUBSCRIPTION_PLANS, PLAN_COMPARISON_MATRIX } from '../data/subscriptionPlans';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPurchaserJourneyTests() {
  console.log('\n========================================');
  console.log('   HIMS PURCHASER JOURNEY TEST SUITE');
  console.log('========================================\n');

  let passed = 0;

  // 1. Plan Configurations
  console.log('--- 1. SUBSCRIPTION PLANS TESTS ---');
  assert(Boolean(SUBSCRIPTION_PLANS.basic), 'Basic plan must exist');
  assert(SUBSCRIPTION_PLANS.basic.maxAdministrators === 1, 'Basic plan allows 1 admin');
  assert(SUBSCRIPTION_PLANS.basic.isFree === true, 'Basic plan is free');
  console.log('  ✓ PASS: Basic plan defined with max 1 administrator');
  passed++;

  assert(Boolean(SUBSCRIPTION_PLANS.pro), 'Pro plan must exist');
  assert(SUBSCRIPTION_PLANS.pro.maxAdministrators === 3, 'Pro plan allows 3 admins');
  assert(SUBSCRIPTION_PLANS.pro.employeeCapacityNumber === 500, 'Pro plan capacity is 500');
  console.log('  ✓ PASS: Pro plan defined with max 3 administrators and 500 employee capacity');
  passed++;

  assert(Boolean(SUBSCRIPTION_PLANS.enterprise), 'Enterprise plan must exist');
  assert(SUBSCRIPTION_PLANS.enterprise.maxAdministrators === 8, 'Enterprise plan allows 8 admins');
  assert(SUBSCRIPTION_PLANS.enterprise.employeeCapacityNumber === 10000, 'Enterprise plan capacity is 10,000');
  console.log('  ✓ PASS: Ultra (Enterprise) plan defined with max 8 administrators and 10,000 capacity');
  passed++;

  assert(PLAN_COMPARISON_MATRIX.length >= 8, 'Comparison matrix contains all feature categories');
  console.log('  ✓ PASS: Comprehensive feature comparison matrix loaded');
  passed++;

  // 2. Purchaser Registration & Verification Flow
  console.log('\n--- 2. PURCHASER REGISTRATION & EMAIL OTP FLOW ---');
  const testEmail = `buyer_${Date.now()}@healthsystem.org`;
  const regResult = purchaserService.registerPurchaser({
    fullName: 'Lady Cynthia Vance',
    email: testEmail,
    password: 'Password@123',
    confirmPassword: 'Password@123',
  });
  assert(Boolean(regResult.devOtp), 'Dev OTP generated for purchaser registration');
  assert(regResult.devOtp.length === 6, 'Dev OTP is 6 digits');
  console.log('  ✓ PASS: Purchaser registration dispatches simulated 6-digit dev OTP');
  passed++;

  // Test email verification
  const verifyResult = purchaserService.verifyPurchaserEmail(testEmail, regResult.devOtp);
  assert(verifyResult.purchaser.isEmailVerified === true, 'Purchaser marked verified');
  assert(purchaserService.getCurrentPurchaser()?.email === testEmail.toLowerCase(), 'Purchaser auto-signed in');
  console.log('  ✓ PASS: Dev OTP verification activates purchaser account and session');
  passed++;

  // 3. Purchase Workflows (Basic, Pro, Enterprise)
  console.log('\n--- 3. PURCHASE & SUBSCRIPTION ACTIVATION ---');
  // Free Basic Activation
  const basicSub = purchaserService.createSubscription({
    planId: 'basic',
    billingFrequency: 'free',
  });
  assert(basicSub.planId === 'basic', 'Basic subscription created');
  assert(basicSub.maxAdministrators === 1, 'Basic sub inherits 1 admin limit');
  assert(basicSub.adminSetupStatus === 'pending_hospital', 'Hospital registration initially pending');
  console.log('  ✓ PASS: Basic plan free activation provisions subscription with 1 admin quota');
  passed++;

  // Pro Simulated Checkout & Purchase
  const proPaymentSuccess = purchaserService.simulatePayment('pro', true);
  assert(proPaymentSuccess.success === true, 'Simulated payment succeeds');
  const proSub = purchaserService.createSubscription({
    planId: 'pro',
    billingFrequency: 'annual',
  });
  assert(proSub.planId === 'pro', 'Pro subscription created');
  assert(proSub.maxAdministrators === 3, 'Pro sub inherits 3 admin limit');
  assert(proSub.id !== basicSub.id, 'Sub IDs are unique');
  console.log('  ✓ PASS: Pro tier checkout provisions independent subscription with 3 admin quota');
  passed++;

  // Enterprise Simulated Checkout & Purchase
  const entSub = purchaserService.createSubscription({
    planId: 'enterprise',
    billingFrequency: 'annual',
  });
  assert(entSub.planId === 'enterprise', 'Enterprise subscription created');
  assert(entSub.maxAdministrators === 8, 'Enterprise sub inherits 8 admin limit');
  console.log('  ✓ PASS: Ultra (Enterprise) tier provisions independent subscription with 8 admin quota');
  passed++;

  // Simulated Payment Failure Test
  const failResult = purchaserService.simulatePayment('pro', false);
  assert(failResult.success === false, 'Payment failure simulation returns error');
  console.log('  ✓ PASS: Payment failure simulation produces clear decline state');
  passed++;

  // 4. Multi-Hospital Management Tests
  console.log('\n--- 4. MULTI-HOSPITAL & HOSPITAL UID REGISTRATION ---');
  const activeSubs = purchaserService.getPurchaserSubscriptions();
  assert(activeSubs.length >= 3, 'Multiple subscriptions exist under single purchaser account');
  console.log(`  ✓ PASS: Single purchaser account owns ${activeSubs.length} independent subscriptions`);
  passed++;

  // Register Hospital A for Pro Subscription
  const hospAResult = purchaserService.registerHospital(proSub.id, {
    officialName: 'Metro General Pavilion',
    hospitalType: 'General Hospital',
    registeredAddress: '100 Medical Blvd',
    city: 'Metropolis',
    state: 'Central',
    country: 'United States',
    officialContactEmail: 'contact@metro-general.org',
    contactPhone: '+1 (555) 123-4567',
  });
  assert(Boolean(hospAResult.hospital.hospitalUid), 'Hospital UID generated');
  assert(hospAResult.hospital.hospitalUid.startsWith('HSP-'), 'Hospital UID has HSP prefix');
  assert(hospAResult.subscription.hospitalId === hospAResult.hospital.id, 'Subscription linked to Hospital A');
  assert(hospAResult.subscription.adminSetupStatus === 'incomplete', 'Admin setup unlocked');
  console.log(`  ✓ PASS: Hospital A registered with UID ${hospAResult.hospital.hospitalUid}`);
  passed++;

  // Register Hospital B for Enterprise Subscription independently
  const hospBResult = purchaserService.registerHospital(entSub.id, {
    officialName: 'Heart & Vascular Specialty Institute',
    hospitalType: 'Specialty Medical Center',
    registeredAddress: '200 Cardiac Way',
    city: 'Hillsborough',
    state: 'Western',
    country: 'United States',
    officialContactEmail: 'admin@vascular-health.org',
    contactPhone: '+1 (555) 987-6543',
  });
  assert(hospBResult.hospital.hospitalUid !== hospAResult.hospital.hospitalUid, 'Hospital UIDs are unique');
  assert(hospBResult.subscription.maxAdministrators === 8, 'Hospital B retains 8 admin limit independently');
  console.log(`  ✓ PASS: Hospital B registered with unique UID ${hospBResult.hospital.hospitalUid}`);
  passed++;

  // Verify Basic Subscription still has hospital registration pending (not forced)
  const refreshedBasic = purchaserService.getSubscriptionById(basicSub.id);
  assert(refreshedBasic?.hospitalId === undefined, 'Basic sub hospital registration is deferred');
  assert(refreshedBasic?.adminSetupStatus === 'pending_hospital', 'Admin setup waits for hospital registration');
  console.log('  ✓ PASS: Deferred hospital registration verified (registration not forced)');
  passed++;

  // 5. Authentication Separation & Direct Login
  console.log('\n--- 5. AUTHENTICATION SEPARATION & DIRECT LOGIN ---');
  // Log out test purchaser
  purchaserService.logoutPurchaser();
  assert(purchaserService.getCurrentPurchaser() === null, 'Purchaser session terminated');

  // Direct Purchaser Login (e.g. from homepage header)
  const loginRes = purchaserService.loginPurchaser(testEmail, 'Password@123');
  assert(loginRes.purchaser.email === testEmail.toLowerCase(), 'Direct purchaser login succeeded');
  console.log('  ✓ PASS: Direct purchaser login authenticates directly to dashboard');
  passed++;

  console.log('\n========================================');
  console.log(`TEST RESULTS: ${passed} PASSED, 0 FAILED`);
  console.log('========================================\n');
}

runPurchaserJourneyTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

