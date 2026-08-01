import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCommunityPostHtml, renderPublicOriginHtml } from './communitySeo';

const template = '<html><head><meta name="description" content="old"><meta property="og:type" content="website"><meta property="og:title" content="old"><meta property="og:description" content="old"><title>Old</title></head><body></body></html>';

test('public HTML carries the configured canonical origin for client metadata', () => {
  const html = renderPublicOriginHtml(template, 'https://staging.findadrop.org/path');
  assert.match(html, /name="drop-public-origin" content="https:\/\/staging\.findadrop\.org"/);
});

test('community article HTML exposes canonical social and BlogPosting metadata', () => {
  const html = renderCommunityPostHtml(template, {
    slug: 'a-donor-story-1234',
    type: 'DONATION_STORY',
    title: 'A donor story',
    excerpt: 'A safe donation story from the community.',
    body_text: 'The complete, crawler-readable story body.',
    author_name: 'Helpful member',
    published_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T11:00:00.000Z',
    image_url: '/media/community/image-key',
    image_alt: 'A donor after giving blood'
  }, 'https://findadrop.org');

  assert.match(html, /<title>A donor story — Drop Community<\/title>/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /rel="canonical" href="https:\/\/findadrop\.org\/community\/a-donor-story-1234"/);
  assert.match(html, /property="og:image" content="https:\/\/findadrop\.org\/media\/community\/image-key"/);
  assert.match(html, /property="og:image:alt" content="A donor after giving blood"/);
  assert.match(html, /id="community-post-structured-data" type="application\/ld\+json"/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"datePublished":"2026-08-01T10:00:00.000Z"/);
  assert.match(html, /"articleBody":"The complete, crawler-readable story body\."/);
  assert.match(html, /"isAccessibleForFree":true/);
});

test('community article HTML escapes untrusted fields and JSON-LD script endings', () => {
  const html = renderCommunityPostHtml(template, {
    slug: 'safe-slug',
    type: 'HEALTH_SUGGESTION',
    title: '<img src=x onerror=alert(1)>',
    excerpt: 'Useful & safe "advice"',
    body_text: 'A full body with </script> text.',
    author_name: '</script><script>alert(1)</script>',
    published_at: '2026-08-01T10:00:00.000Z',
    updated_at: '2026-08-01T10:00:00.000Z'
  }, 'https://findadrop.org');

  assert.equal(html.includes('<img src=x'), false);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(html.includes('</script><script>alert(1)</script>'), false);
  assert.match(html, /\\u003c\/script\\u003e/);
});
