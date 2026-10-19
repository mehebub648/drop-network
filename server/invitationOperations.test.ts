import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignSendTimes, createInvitation, deliveryAggregate, safeContributionFileName, validatePacing } from './invitationOperations';

const pacing = { start_per_minute: 1, peak_per_minute: 10, end_per_minute: 2, ramp_up_minutes: 10, steady_minutes: 10, ramp_down_minutes: 10 };

test('campaign pacing starts slowly, accelerates, and stays deterministic', () => {
  assert.deepEqual(validatePacing(pacing), pacing);
  const first = campaignSendTimes(20, '2026-10-20T00:00:00.000Z', 'RAMPED', pacing);
  assert.deepEqual(first, campaignSendTimes(20, '2026-10-20T00:00:00.000Z', 'RAMPED', pacing));
  const gaps = first.slice(1).map((item, index) => Date.parse(item) - Date.parse(first[index]));
  assert.ok(gaps[0] > gaps[10]);
});

test('instant campaigns share one planned release time', () => {
  assert.equal(new Set(campaignSendTimes(20, '2026-10-20T00:00:00.000Z', 'INSTANT', pacing)).size, 1);
});

test('file names and pacing reject unsafe input', () => {
  assert.equal(safeContributionFileName('../donors.csv'), null);
  assert.equal(safeContributionFileName('donors.csv'), 'donors.csv');
  assert.equal(validatePacing({ ...pacing, peak_per_minute: 0 }), null);
});

test('delivery and owner outcomes remain separate', () => {
  const invitation = createInvitation({ donor_public_id: 'opaque', donor_phone: '+8801712345678', claim_path: '/c/abc', now: '2026-10-20T00:00:00.000Z' });
  invitation.delivery_status = 'DELIVERED';
  invitation.outcome = 'NO_RESPONSE';
  assert.deepEqual(deliveryAggregate([invitation]), { selected: 1, queued: 0, sent: 0, delivered: 1, failed: 0, claimed: 0, phone_changed: 0, separate_account: 0, rejected_removed: 0, no_response: 1 });
});
