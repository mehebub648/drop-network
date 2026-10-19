import test from 'node:test';
import assert from 'node:assert/strict';
import { publicComments, commentsVisibleToBlockedAuthors, commentParent, type RequestComment } from './requestComments';

const root: RequestComment = { id: 'root', user_id: 'private-actor', user_name: 'Member', text: 'An update', created_at: '2026-09-09T00:00:00Z', client_id: 'private-retry' };
test('visible comments expose only an explicitly projected opaque author id', () => {
  const [comment] = publicComments([root], '', false, () => 'public-author');
  assert.equal(comment.text, 'An update');
  assert.equal(comment.author_id, 'public-author');
  assert.equal(comment.can_delete, false);
  assert.equal('user_id' in comment, false);
  assert.equal('client_id' in comment, false);
  assert.equal(publicComments([root], 'public-author', false, () => 'public-author')[0].can_delete, true);
  assert.equal(publicComments([root], 'owner', true)[0].can_delete, true);
});
test('deleted and moderated parents retain thread anchors without publishing content', () => {
  const removed = publicComments([{ ...root, deleted_at: 'now' }], root.user_id, true, () => 'public-author')[0];
  assert.equal(removed.text, 'Comment deleted');
  assert.equal(removed.user_name, '');
  assert.equal(removed.can_delete, false);
  assert.equal('author_id' in removed, false);
  assert.equal(publicComments([{ ...root, moderation_status: 'HIDDEN' }], '', false)[0].deleted, true);
});
test('blocked registered and guest authors are removed using their public ids', () => {
  const registered = { ...root, id: 'registered', user_id: 'member-id' };
  const guest = { ...root, id: 'guest', user_id: 'private-guest-reference' };
  const visible = { ...root, id: 'visible', user_id: 'another-member' };
  const publicIds: Record<string, string> = { 'member-id': 'member-id', 'private-guest-reference': 'guest:opaque-id', 'another-member': 'another-member' };
  const comments = commentsVisibleToBlockedAuthors(
    [registered, guest, visible],
    new Set(['member-id', 'guest:opaque-id']),
    comment => publicIds[comment.user_id]
  );
  assert.deepEqual(comments.map(comment => comment.id), ['visible']);
});
test('replies stay one level deep and reject missing or unavailable parents', () => {
  const reply = { ...root, id: 'reply', parent_id: 'root' };
  assert.equal(commentParent([root, reply], 'reply'), 'root');
  assert.equal(commentParent([root], 'root'), 'root');
  assert.equal(commentParent([root]), undefined);
  assert.throws(() => commentParent([root], 'another-request-comment'));
  assert.throws(() => commentParent([{ ...root, deleted_at: 'now' }], 'root'));
});
