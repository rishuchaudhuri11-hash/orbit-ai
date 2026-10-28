import test from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, randomToken, providerConfig } from '../server/ai.js';

test('session token is random and hash does not equal raw token', () => {
  const token = randomToken();
  assert.ok(token.length >= 40);
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token), hashToken(token));
});

test('provider config has the three intended adapters', () => {
  const cfg = providerConfig();
  assert.deepEqual(cfg.map(p => p.id), ['groq', 'gemini', 'openrouter']);
  assert.ok(cfg.every(p => p.label && p.model));
});
