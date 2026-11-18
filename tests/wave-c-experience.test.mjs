import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { authFeedback } from '../lib/auth-feedback.js';
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('U8 - authentication errors use recoverable, non-disclosing portal copy', () => {
  assert.match(authFeedback({ code: 'auth/invalid-credential' }), /Email or password not recognized/);
  assert.equal(authFeedback({ code: 'auth/user-not-found' }), authFeedback({ code: 'auth/wrong-password' }));
  assert.match(authFeedback({ code: 'auth/too-many-requests' }), /Try again later/);
  assert.doesNotMatch(authFeedback({code:'auth/internal-error', message:'secret token 123'}), /secret token/);
  assert.match(source('components/login-app.js'), /role="alert"/);
  assert.match(source('components/login-app.js'), /useReducedMotion/);
});

test('U9 - homepage experiences are separate dynamic bundles and the loading UI is nonblocking', () => {
  const router = source('components/public-home-router.js');
  assert.match(router, /dynamic\(\(\) => import\("@\/components\/marketplace-app"\)/);
  assert.match(router, /dynamic\(\(\) => import\("@\/components\/first-access-landing"\)/);
  assert.match(source('app/loading.js'), /SpotlyPulseLoader/);
  assert.doesNotMatch(source('app/loading.js'), /animate-spin/);
  assert.match(source('components/spotly-vitals.js'), /NEXT_PUBLIC_SPOTLY_VITALS_MODE/);
  assert.doesNotMatch(source('components/spotly-vitals.js'), /sendBeacon|fetch\(/);
});

test('U7 - PWA manifest resolves the appropriate official icon family', () => {
  const manifest=source('app/manifest.js');
  assert.match(manifest, /\/brand\/pwa\/\$\{symbol\}\/icon-192\.png/);
  for(const family of ['primary','business','driver']) {
    for(const name of ['icon-192.png','icon-512.png','icon-maskable-512.png']) {
      const path=new URL(`../public/brand/pwa/${family}/${name}`,import.meta.url);
      assert.ok(existsSync(path), `${family}/${name}`);
    }
  }
});

test('U7, U10, U11 - native source uses official marks and content-safe navigation', () => {
  const driver = readFileSync(new URL('../../../driver/spotlydriver/spotlydriver/Core/Components/SpotlyLogoMark.swift',import.meta.url),'utf8');
  const splash = readFileSync(new URL('../../../driver/spotlydriver/spotlydriver/Features/Entry/DriverSplashView.swift',import.meta.url),'utf8');
  const business = readFileSync(new URL('../../../business/spotlybusiness/spotlybusiness/Features/Entry/EntryFlowView.swift',import.meta.url),'utf8');
  const banner = readFileSync(new URL('../../../business/spotlybusiness/spotlybusiness/Features/Entry/MainTabView.swift',import.meta.url),'utf8');
  assert.match(driver,/SpotlyDriverMarkColor/);
  assert.doesNotMatch(driver,/location\.fill/);
  assert.doesNotMatch(splash,/asyncAfter/);
  assert.match(business,/SpotlyBusinessMarkColor/);
  assert.match(banner,/safeAreaInset\(edge: \.top/);
});
