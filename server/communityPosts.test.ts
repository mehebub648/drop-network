import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const originalDatabasePath = process.env.LANCEDB_PATH;
const databasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'drop-community-posts-test-'));
process.env.LANCEDB_PATH = databasePath;
const community = await import('./communityPosts');
const database = await import('./db');

after(async () => {
  (await database.getDb()).close();
  if (originalDatabasePath === undefined) delete process.env.LANCEDB_PATH;
  else process.env.LANCEDB_PATH = originalDatabasePath;
  await fs.rm(databasePath, { recursive: true, force: true });
});

const storyBody = [
  '## A day that reminded us why donors matter',
  '',
  'Our neighbour answered the request, reached the hospital, and completed every screening step with the clinical team.',
  '',
  'The family thanked the donor and the blood bank staff for coordinating the donation safely.'
].join('\n');

function draft(overrides: Partial<Parameters<typeof community.saveCommunityPost>[0]> = {}) {
  return {
    id: 'post-00000001',
    author_id: 'member-00000001',
    type: 'DONATION_STORY' as const,
    status: 'DRAFT' as const,
    title: 'A neighbour answered the call',
    body_markdown: storyBody,
    created_at: '2026-07-01T08:00:00.000Z',
    updated_at: '2026-07-01T08:00:00.000Z',
    ...overrides
  };
}

test('Unicode slugs retain useful words and add a deterministic short id suffix', () => {
  const slug = community.createCommunitySlug('রক্তদানের গল্প: মা ও শিশু', 'post-12345678');
  assert.equal(slug, 'রক্তদানের-গল্প-মা-ও-শিশু-12345678');
  assert.equal(/[\s/\\]/u.test(slug), false);
  assert.equal(community.createCommunitySlug('রক্তদানের গল্প: মা ও শিশু', 'post-12345678'), slug);
});

test('Markdown excerpts keep readable text and remove formatting and destinations', () => {
  const excerpt = community.markdownToPlainExcerpt(
    '# A **useful** story\n\nRead [the guidance](https://example.test) before `sharing`.\n\n![Donor at a clinic](https://example.test/image.jpg)',
    80
  );
  assert.equal(excerpt, 'A useful story Read the guidance before sharing. Donor at a clinic');
  assert.equal(excerpt.includes('https://'), false);
  assert.equal(community.markdownToPlainExcerpt('A very long community update that needs shortening.', 24), 'A very long community…');
});

test('validation rejects public phone numbers and images on health suggestions', () => {
  const phone = community.validateCommunityPostInput({
    type: 'DONATION_STORY',
    title: 'Please contact this donor',
    body_markdown: `${storyBody}\nCall +880 1712-345678 for more information.`
  });
  assert.equal(phone.ok, false);
  if (!phone.ok) assert.equal(phone.errors.includes('Public posts cannot include Bangladesh phone numbers'), true);

  for (const obfuscatedPhone of ['০১৭১২৩৪৫৬৭৮', '017**12**345678']) {
    const obfuscated = community.validateCommunityPostInput({
      type: 'DONATION_STORY',
      title: 'Please contact this donor',
      body_markdown: `${storyBody}\nCall ${obfuscatedPhone} for more information.`
    });
    assert.equal(obfuscated.ok, false, `${obfuscatedPhone} should be rejected`);
    if (!obfuscated.ok) assert.equal(obfuscated.errors.includes('Public posts cannot include Bangladesh phone numbers'), true);
  }

  const healthImage = community.validateCommunityPostInput({
    type: 'HEALTH_SUGGESTION',
    title: 'Preparing for a donation appointment',
    body_markdown: 'Ask the collection team what preparation is appropriate for you. Follow their instructions and disclose medicines or symptoms before donating blood.',
    image_key: 'image_12345678',
    image_alt: 'A glass of water'
  });
  assert.equal(healthImage.ok, false);
  if (!healthImage.ok) assert.equal(healthImage.errors.includes('Health suggestions cannot include an image'), true);

  const valid = community.validateCommunityPostInput({
    type: 'DONATION_STORY',
    title: 'A neighbour answered the call',
    body_markdown: storyBody,
    image_key: 'image_12345678',
    image_alt: 'A donor resting after screening',
    image_width: 1200,
    image_height: 800
  });
  assert.equal(valid.ok, true);
});

test('published posts persist with filter columns and keep their first slug', async () => {
  const published = await community.saveCommunityPost(draft({
    status: 'PUBLISHED',
    source_donation_id: 'donation-private-0001',
    published_at: '2026-07-02T08:00:00.000Z'
  }));
  assert.ok(published.slug);
  assert.equal(published.source_donation_id, 'donation-private-0001');

  const table = await community.ensureCommunityPostTable();
  const schema = await table.schema();
  for (const column of ['id', 'slug', 'author_id', 'type', 'status', 'published_at', 'updated_at', 'image_key', 'doc']) {
    assert.equal(schema.fields.some(field => field.name === column), true, `${column} should be a real column`);
  }

  const renamed = await community.saveCommunityPost({
    ...published,
    title: 'A corrected story title',
    updated_at: '2026-07-03T08:00:00.000Z'
  });
  assert.equal(renamed.slug, published.slug);
  assert.equal((await community.getCommunityPostById(published.id))?.title, 'A corrected story title');

  await assert.rejects(
    community.saveCommunityPost({ ...renamed, slug: 'changed-slug-00000001' }),
    /slug cannot be changed/
  );
});

test('public queries return newest published posts and exclude hidden or draft rows', async () => {
  const oldPost = await community.saveCommunityPost(draft({
    id: 'post-00000002',
    status: 'PUBLISHED',
    title: 'An earlier donation story',
    published_at: '2026-07-04T08:00:00.000Z',
    updated_at: '2026-07-04T08:00:00.000Z'
  }));
  const newestPost = await community.saveCommunityPost(draft({
    id: 'post-00000003',
    status: 'PUBLISHED',
    title: 'The latest donation story',
    published_at: '2026-07-06T08:00:00.000Z',
    updated_at: '2026-07-06T08:00:00.000Z'
  }));
  const hiddenPost = await community.saveCommunityPost(draft({
    id: 'post-00000004',
    status: 'PUBLISHED',
    title: 'A story hidden after review',
    published_at: '2026-07-07T08:00:00.000Z',
    updated_at: '2026-07-07T08:00:00.000Z'
  }));
  await community.saveCommunityPost({
    ...hiddenPost,
    status: 'HIDDEN',
    updated_at: '2026-07-08T08:00:00.000Z',
    moderated_by: 'moderator-0001',
    moderated_at: '2026-07-08T08:00:00.000Z',
    moderation_reason: 'Privacy review'
  });
  await community.saveCommunityPost(draft({
    id: 'post-00000005',
    title: 'A private draft story',
    updated_at: '2026-07-09T08:00:00.000Z'
  }));

  const published = await community.queryPublishedCommunityPosts({
    limit: 20,
    near: '2026-08-01T00:00:00.000Z'
  });
  const relevant = published.filter(post => [oldPost.id, newestPost.id, hiddenPost.id].includes(post.id));
  assert.deepEqual(relevant.map(post => post.id), [newestPost.id, oldPost.id]);
  assert.equal(await community.getPublishedCommunityPostBySlug(hiddenPost.slug!), null);
  assert.equal(await community.countCommunityPosts({ statuses: ['HIDDEN'] }), 1);

  const ownerPosts = await community.queryCommunityPostsByOwner('member-00000001', { limit: 20 });
  assert.equal(ownerPosts.some(post => post.status === 'DRAFT'), true);
  assert.equal(ownerPosts.some(post => post.status === 'HIDDEN'), true);
});

test('public projections expose only supplied author display data', async () => {
  const post = await community.getCommunityPostById('post-00000003');
  assert.ok(post);
  const summary = community.toPublicCommunityPostSummary(post, 'Helpful Member');
  const detail = community.toPublicCommunityPostDetail(post, '+8801712345678');

  assert.deepEqual(summary.author, { name: 'Helpful Member' });
  assert.equal('author_id' in summary, false);
  assert.equal('status' in summary, false);
  assert.equal('body_markdown' in summary, false);
  assert.equal('source_donation_id' in summary, false);
  assert.equal('source_donation_id' in detail, false);
  assert.equal(detail.author.name, 'Drop member');
  assert.equal(detail.body_markdown, post.body_markdown);
});

test('query filters escape caller-supplied values', () => {
  assert.equal(
    community.buildCommunityPostFilter({ authorId: "member'o", statuses: ['PUBLISHED'], type: 'DONATION_STORY' }),
    `status IN ('PUBLISHED') AND type = 'DONATION_STORY' AND author_id = 'member''o'`
  );
});
