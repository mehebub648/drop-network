import test from 'node:test';
import assert from 'node:assert/strict';
import { publicComments, commentParent, type RequestComment } from './requestComments';

const root: RequestComment = { id: 'root', user_id: 'private-actor', user_name: 'Member', text: 'An update', created_at: '2026-09-09T00:00:00Z', client_id: 'private-retry' };
test('all viewers receive public comments without identifiers or retry credentials', () => {
  const [comment] = publicComments([root], '', false);
  assert.equal(comment.text, 'An update');
  assert.equal(comment.can_delete, false);
  assert.equal('user_id' in comment, false);
  assert.equal('client_id' in comment, false);
  assert.equal(publicComments([root], root.user_id, false)[0].can_delete, true);
  assert.equal(publicComments([root], 'owner', true)[0].can_delete, true);
});
test('deleted and moderated parents retain thread anchors without publishing content', () => {
  const removed = publicComments([{ ...root, deleted_at: 'now' }], root.user_id, true)[0];
  assert.equal(removed.text, 'Comment deleted');
  assert.equal(removed.user_name, '');
  assert.equal(removed.can_delete, false);
  assert.equal(publicComments([{ ...root, moderation_status: 'HIDDEN' }], '', false)[0].deleted, true);
});
test('replies stay one level deep and reject missing or unavailable parents', () => {
  const reply = { ...root, id: 'reply', parent_id: 'root' };
  assert.equal(commentParent([root, reply], 'reply'), 'root');
  assert.equal(commentParent([root], 'root'), 'root');
  assert.equal(commentParent([root]), undefined);
  assert.throws(() => commentParent([root], 'another-request-comment'));
  assert.throws(() => commentParent([{ ...root, deleted_at: 'now' }], 'root'));
});
