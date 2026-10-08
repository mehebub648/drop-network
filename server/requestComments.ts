export type RequestComment = {
  id: string; user_id: string; user_name: string; text: string; created_at: string;
  parent_id?: string; deleted_at?: string; client_id?: string;
  moderation_status?: 'VISIBLE' | 'HIDDEN';
};

export function publicComments(comments: RequestComment[], actor: string, manage: boolean) {
  return comments.map(comment => {
    const removed = Boolean(comment.deleted_at || comment.moderation_status === 'HIDDEN');
    return {
      id: comment.id, user_name: removed ? '' : comment.user_name,
      text: removed ? 'Comment deleted' : comment.text, created_at: comment.created_at,
      parent_id: comment.parent_id || null, deleted: removed,
      can_delete: !removed && (manage || Boolean(actor && actor === comment.user_id)),
      is_mine: Boolean(actor && actor === comment.user_id),
    };
  });
}

export function commentParent(comments: RequestComment[], parentId?: string) {
  if (!parentId) return undefined;
  const parent = comments.find(item => item.id === parentId);
  if (!parent || parent.deleted_at || parent.moderation_status === 'HIDDEN') throw new Error('This comment is no longer available for replies.');
  return parent.parent_id || parent.id;
}
