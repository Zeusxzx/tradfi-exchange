const test = require('node:test');
const assert = require('node:assert/strict');
const { getMarketStatus, getPublicConfig } = require('../server');

test('opens during a normal NYSE core session', () => {
  const status = getMarketStatus(new Date('2026-08-25T15:00:00.000Z'));
  assert.equal(status.isOpen, true);
  assert.equal(status.reason, 'Market open');
  assert.equal(status.coreHours, '9:30 AM–4:00 PM ET');
});

test('closes after the normal closing auction', () => {
  const status = getMarketStatus(new Date('2026-08-25T20:00:00.000Z'));
  assert.equal(status.isOpen, false);
  assert.equal(status.reason, 'After hours');
  assert.match(status.nextOpenAt, /:30:00\.000Z$/);
});

test('closes on an official holiday', () => {
  const status = getMarketStatus(new Date('2026-12-25T16:00:00.000Z'));
  assert.equal(status.isOpen, false);
  assert.equal(status.reason, 'NYSE holiday');
});

test('closes on weekends', () => {
  const status = getMarketStatus(new Date('2026-08-29T16:00:00.000Z'));
  assert.equal(status.isOpen, false);
  assert.equal(status.reason, 'Weekend');
});

test('honors the published 1 PM early close', () => {
  const beforeClose = getMarketStatus(new Date('2026-11-27T17:30:00.000Z'));
  const afterClose = getMarketStatus(new Date('2026-11-27T18:00:00.000Z'));
  assert.equal(beforeClose.isOpen, true);
  assert.equal(beforeClose.earlyClose, true);
  assert.equal(afterClose.isOpen, false);
  assert.equal(afterClose.reason, 'Early close');
});

test('exposes non-secret Robinhood Chain configuration', () => {
  const config = getPublicConfig();
  assert.equal(config.chain.id, 4663);
  assert.equal(config.chain.hexId, '0x1237');
  assert.equal(config.tokenAddress, '');
});
