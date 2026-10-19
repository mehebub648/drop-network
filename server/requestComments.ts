export type RequestComment = {
  id: string; user_id: string; user_name: string; text: string; created_at: string;
  parent_id?: string; deleted_at?: string; client_id?: string;
  moderation_status?: 'VISIBLE' | 'HIDDEN';
};

export function publicComments(
  comments: RequestComment[],
  actor: string,
  manage: boolean,
  publicAuthorId: (comment: RequestComment) => string | undefined = () => undefined
) {
  return comments.map(comment => {
    const removed = Boolean(comment.deleted_at || comment.moderation_status === 'HIDDEN');
    const authorId = removed ? undefined : publicAuthorId(comment);
    return {
      id: comment.id, user_name: removed ? '' : comment.user_name,
      text: removed ? 'Comment deleted' : comment.text, created_at: comment.created_at,
      parent_id: comment.parent_id || null, deleted: removed,
      ...(authorId ? { author_id: authorId } : {}),
      can_delete: !removed && (manage || Boolean(actor && (actor === comment.user_id || actor === authorId))),
      is_mine: Boolean(actor && (actor === comment.user_id || actor === authorId)),
    };
  });
}

export function commentsVisibleToBlockedAuthors(
  comments: RequestComment[],
  blockedAuthorIds: Set<string>,
  publicAuthorId: (comment: RequestComment) => string | undefined
) {
  return comments.filter(comment => {
    const authorId = publicAuthorId(comment);
    return !authorId || !blockedAuthorIds.has(authorId);
  });
}

export function commentParent(comments: RequestComment[], parentId?: string) {
  if (!parentId) return undefined;
  const parent = comments.find(item => item.id === parentId);
  if (!parent || parent.deleted_at || parent.moderation_status === 'HIDDEN') throw new Error('This comment is no longer available for replies.');
  return parent.parent_id || parent.id;
}
