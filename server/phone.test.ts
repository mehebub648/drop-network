import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAY_REVIEWER_PHONE, isPlayReviewerPhone, normalizeBangladeshPhone, normalizePasswordLoginPhone } from './phone';

test('the reviewer identifier is accepted only by password login normalization', () => {
  for (const input of [PLAY_REVIEWER_PHONE, '01000000046', '1000000046', '+880 1000 000046']) {
    assert.equal(normalizePasswordLoginPhone(input), PLAY_REVIEWER_PHONE);
    assert.equal(isPlayReviewerPhone(input), true);
    assert.equal(normalizeBangladeshPhone(input), null);
  }
  for (const input of ['01000000047', '+8801200000046', '', null, 1000000046]) {
    assert.equal(normalizePasswordLoginPhone(input), null);
    assert.equal(isPlayReviewerPhone(input), false);
  }
});

test('ordinary Bangladesh phone validation retains its existing prefixes and formats', () => {
  for (const prefix of ['13', '14', '15', '16', '17', '18', '19']) {
    const local = `${prefix}12345678`;
    assert.equal(normalizeBangladeshPhone(`0${local}`), `+880${local}`);
    assert.equal(normalizePasswordLoginPhone(`+880 ${local}`), `+880${local}`);
  }
  assert.equal(normalizeBangladeshPhone('+8801112345678'), null);
});
