import type { CommunityPostType } from './api';

export const COMMUNITY_TITLE_MIN_LENGTH = 8;
export const COMMUNITY_TITLE_MAX_LENGTH = 120;
export const COMMUNITY_BODY_MIN_LENGTH = 80;
export const COMMUNITY_BODY_MAX_LENGTH = 12_000;
export const COMMUNITY_IMAGE_ALT_MAX_LENGTH = 180;
export const COMMUNITY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function communityPostTypeLabel(type: CommunityPostType) {
  return type === 'DONATION_STORY' ? 'Donation story' : 'Health suggestion';
}

export function communityPostTypeDescription(type: CommunityPostType) {
  return type === 'DONATION_STORY'
    ? 'Share one real donation experience. You may add one image.'
    : 'Share practical wellbeing guidance in Markdown. Images are not used for health suggestions.';
}

export function formatCommunityDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
