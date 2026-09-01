import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingRequestReasonOptions } from './requestReasons';

test('indications keep the Bangladesh frequency order and Other last', () => {
  const options = matchingRequestReasonOptions('');
  assert.equal(options[0].value, 'ANAEMIA');
  assert.equal(options[1].value, 'CHILDBIRTH');
  assert.equal(options.at(-1)?.value, 'OTHER');
});

test('plain-language and clinical synonyms find the intended indication', () => {
  assert.equal(matchingRequestReasonOptions('low hb')[0].value, 'ANAEMIA');
  assert.equal(matchingRequestReasonOptions('c-section')[0].value, 'CHILDBIRTH');
  assert.equal(matchingRequestReasonOptions('hemodialysis')[0].value, 'KIDNEY_DIALYSIS');
});

test('an unmatched search still offers Other', () => {
  assert.deepEqual(matchingRequestReasonOptions('not in this list').map(option => option.value), ['OTHER']);
});
