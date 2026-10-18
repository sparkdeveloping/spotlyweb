import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('V7 customer shell has intentional desktop utilities and five mobile destinations', () => {
  const source = read('components/customer-shell.js');
  for (const label of ['Home', 'Search', 'Activity', 'Saved', 'Profile']) assert.match(source, new RegExp(`label: "${label}"`));
  assert.match(source, /grid-cols-5/);
  assert.match(source, /locationLabel/);
  assert.doesNotMatch(source, /preferredCurrency|currency.*select|<select/i);
});

test('V7 onboarding is progressive and skippable', () => {
  const source = read('components/customer-onboarding.js');
  for (const text of ['Your city, in one place.', 'Where do you usually use Spotly?', 'What would you like Spotly to help with?', 'Make everyday trips quicker.', 'Explore first']) assert.ok(source.includes(text));
  assert.match(source, /Use my location/);
  assert.match(source, /Home/);
  assert.match(source, /Work/);
});

test('V7 welcome modal uses a light-scoped backdrop without changing other dialog overlays', () => {
  const onboarding = read('components/customer-onboarding.js');
  const ui = read('components/ui.js');
  const styles = read('app/globals.css');
  assert.match(onboarding, /bg-\[var\(--onboarding-backdrop\)\]/);
  assert.doesNotMatch(onboarding, /bg-\[var\(--overlay\)\]/);
  assert.match(styles, /--onboarding-backdrop: rgba\(249, 250, 255, 0\.66\)/);
  assert.match(styles, /--onboarding-backdrop: rgba\(8, 11, 20, 0\.40\)/);
  assert.match(ui, /bg-\[var\(--overlay\)\]/);
});

test('V7 Home only claims repeat behavior from real completed history', () => {
  const source = read('components/marketplace-home.js');
  assert.match(source, /const completedStatuses = new Set/);
  assert.match(source, /latestRepeatBusiness \?/);
  assert.doesNotMatch(source, /Search nearby/);
  assert.doesNotMatch(source, />Open ↗</);
  assert.doesNotMatch(source, /Search all of Spotly/);
  assert.match(source, /Popular in \$\{location\.city\}/);
  assert.match(source, /Based on your interests/);
});

test('V7 service identity includes every Spotly service with reduced-motion support', () => {
  const source = read('components/service-artwork.js');
  for (const service of ['eat', 'shop', 'book', 'events', 'ride', 'send']) assert.match(source, new RegExp(`${service}:`));
  assert.match(source, /useReducedMotion/);
  assert.match(source, /spotly-steam/);
});

test('V7 utility surfaces provide designed new and empty states', () => {
  const source = read('components/customer-utility.js');
  for (const text of ['Find anything on Spotly.', 'Popular searches', 'Search gets better as you use Spotly', 'Save the city you want to come back to', 'Try another search', 'Change location']) assert.ok(source.includes(text));
});

test('V7 account lives inside the Customer Shell and removes raw preference selects', () => {
  const source = read('components/account-app.js');
  assert.match(source, /<CustomerShell current="profile"/);
  assert.doesNotMatch(source, /<header/);
  assert.doesNotMatch(source, /<select/);
  for (const section of ['Profile and contact', 'Saved places', 'Preferences', 'Notifications', 'Privacy & security', 'Where do you want to go?', 'Help']) assert.ok(source.includes(section));
});

test('V7 design tokens constrain geometry and motion while respecting reduced motion', () => {
  const source = read('app/globals.css');
  for (const token of ['--radius-control', '--radius-card-v7', '--radius-feature', '--motion-press', '--motion-state', '--motion-sheet', '--motion-page']) assert.ok(source.includes(token));
  assert.match(source, /prefers-reduced-motion: reduce/);
  for (const service of ['ride', 'eat', 'shop', 'book', 'events', 'send']) assert.ok(source.includes(`service-surface-${service}`));
});

test('V7 release version is synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '7.0.0');
  assert.equal(lock.version, '7.0.0');
  assert.equal(lock.packages[''].version, '7.0.0');
});
