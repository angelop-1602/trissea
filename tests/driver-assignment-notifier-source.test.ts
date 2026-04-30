import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const driverShellSource = readFileSync('components/driver/driver-app-shell.tsx', 'utf8');
const notifierSource = readFileSync('components/driver/driver-assignment-notifier.tsx', 'utf8');

test('driver app shell mounts the assignment notifier for driver workspaces', () => {
  assert.match(driverShellSource, /DriverAssignmentNotifier/);
  assert.match(driverShellSource, /enabled=\{currentUser\?\.role === 'driver'\}/);
});

test('driver assignment notifier listens for assigned ride updates', () => {
  assert.match(notifierSource, /getDriverAssignedRides/);
  assert.match(notifierSource, /useBookingRealtime/);
  assert.match(notifierSource, /payload\.type === 'ride\.updated'/);
  assert.match(notifierSource, /DialogContent/);
  assert.match(notifierSource, /trissea:driver-assignment-notifications/);
});
