import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('full-page route and client entry fallbacks use the same immediate pulse', () => {
  for (const file of ['app/loading.js', 'components/public-home-router.js', 'components/customer-loading.js', 'components/workspace-loading.js']) {
    assert.match(source(file), /SpotlyPulseLoader/, file);
  }
  assert.doesNotMatch(source('components/public-home-router.js'), /v7-skeleton/);
  assert.doesNotMatch(source('app/loading.js'), /v7-skeleton|animate-spin/);
  assert.match(source('components/customer-loading.js'), /export function CustomerContentSkeleton/);
  assert.match(source('components/customer-loading.js'), /v7-skeleton/);
});

test('loader uses only official local symbols and accessible status; no timed or external delay', () => {
  const component = source('components/spotly-pulse-loader.js');
  assert.match(component, /role="status"/);
  assert.match(component, /aria-busy="true"/);
  assert.match(component, /aria-label=\{label\}/);
  assert.match(component, /unoptimized/);
  assert.match(component, /priority/);
  assert.doesNotMatch(component, /setTimeout|setInterval|fetch\(|Math\.random|"use client"|fact|tip/i);
  for (const family of ['primary','business','driver']) {
    const asset = `public/brand/loading/${family}-symbol.svg`;
    assert.ok(existsSync(new URL(`../${asset}`, import.meta.url)), asset);
    assert.match(component, new RegExp(`/brand/loading/${family}-symbol\\.svg`));
    const svg = source(asset);
    assert.match(svg, /<svg/);
    assert.match(svg, /viewBox="0 0 512 640"/);
  }
});

test('loader provides restrained CSS-only pulsing and a motion-free alternative', () => {
  const css = source('app/globals.css');
  assert.match(css, /@keyframes spotly-loader-breathe/);
  assert.match(css, /@keyframes spotly-loader-glow/);
  assert.match(css, /\.spotly-pulse-loader--business/);
  assert.match(css, /\.spotly-pulse-loader--driver/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.spotly-pulse-loader__mark/);
});
