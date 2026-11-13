import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  PERMISSIONS,
  permissionsFor,
  hashPassword,
  verifyPassword,
  createSessionToken,
  readSession
} from '../lib/security.js';

test('password hashes are salted scrypt values and verify correctly', () => {
  const password = 'test-password-for-unit-test';
  const first = hashPassword(password);
  const second = hashPassword(password);

  assert.match(first, /^scrypt:[a-f0-9]+:[a-f0-9]+$/);
  assert.notEqual(first, second, 'two hashes of the same password should use different salts');
  assert.equal(verifyPassword(password, first), true);
  assert.equal(verifyPassword('wrong-password', first), false);
  assert.equal(verifyPassword(password, 'not-a-valid-hash'), false);
});

test('role matrix contains the four configured application roles', () => {
  assert.deepEqual(ROLES, [
    'ADMIN',
    'PROCUREMENT_OFFICER',
    'WAREHOUSE_MANAGER',
    'DEPARTMENT_STAFF'
  ]);
  assert.deepEqual(PERMISSIONS.view, ROLES);
});

test('admin has every configured action', () => {
  assert.deepEqual(permissionsFor('ADMIN').sort(), Object.keys(PERMISSIONS).sort());
});

test('department staff can allocate and request emergency support, but not procure or transfer', () => {
  const allowed = permissionsFor('DEPARTMENT_STAFF');
  assert.ok(allowed.includes('view'));
  assert.ok(allowed.includes('allocate'));
  assert.ok(allowed.includes('requestEmergency'));
  assert.ok(!allowed.includes('transfer'));
  assert.ok(!allowed.includes('createOrder'));
  assert.ok(!allowed.includes('fulfillEmergency'));
});

test('warehouse manager can allocate, transfer, receive, request support and run maintenance', () => {
  const allowed = permissionsFor('WAREHOUSE_MANAGER');
  for (const action of ['view', 'allocate', 'transfer', 'receiveOrder', 'requestEmergency', 'maintenance']) {
    assert.ok(allowed.includes(action), `expected ${action} to be allowed`);
  }
  assert.ok(!allowed.includes('createOrder'));
  assert.ok(!allowed.includes('fulfillEmergency'));
});

test('signed session can be read from the expected cookie', () => {
  const user = {
    user_id: 999,
    username: 'unit.test',
    full_name: 'Unit Test',
    role: 'ADMIN',
    department_id: null
  };
  const token = createSessionToken(user);
  const request = {
    cookies: {
      get(name) {
        return name === 'hsc_session' ? { value: token } : undefined;
      }
    }
  };

  const session = readSession(request);
  assert.equal(session.username, user.username);
  assert.equal(session.role, user.role);
  assert.equal(session.uid, user.user_id);
  assert.ok(session.exp > Math.floor(Date.now() / 1000));
});
