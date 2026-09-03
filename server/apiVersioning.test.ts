import assert from 'node:assert/strict';
import test from 'node:test';
import { rewriteVersionedApiUrl } from './apiVersioning';

test('maps v1 API requests onto the established route handlers', () => {
  assert.equal(rewriteVersionedApiUrl('/api/v1'), '/api');
  assert.equal(rewriteVersionedApiUrl('/api/v1/stats'), '/api/stats');
  assert.equal(
    rewriteVersionedApiUrl('/api/v1/requests?page=2&urgent=true'),
    '/api/requests?page=2&urgent=true'
  );
});

test('does not rewrite legacy, future, or lookalike paths', () => {
  assert.equal(rewriteVersionedApiUrl('/api/stats'), null);
  assert.equal(rewriteVersionedApiUrl('/api/v2/stats'), null);
  assert.equal(rewriteVersionedApiUrl('/api/v1beta/stats'), null);
});
