import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPostNotification } from '../src/discord.js';

test('sendPostNotification validates invalid webhook URLs gracefully', async () => {
  await assert.rejects(
    async () => {
      await sendPostNotification('https://malicious-site.com', { id: '123' });
    },
    /Invalid DISCORD_WEBHOOK_URL/
  );
});

test('sendPostNotification formats payload with Instagram colors and caption truncation', async () => {
  let capturedPayload = null;

  // Intercept fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({})
    };
  };

  try {
    const longCaption = 'A'.repeat(700);
    const mockPost = {
      id: 'post_999',
      permalink: 'https://instagram.com/p/test1234/',
      caption: longCaption,
      media_type: 'VIDEO',
      thumbnail_url: 'https://cdn.instagram.com/thumb.jpg',
      timestamp: '2026-09-18T15:00:00Z',
      username: 'oryx_official'
    };

    await sendPostNotification('https://discord.com/api/webhooks/123/abc', mockPost, {
      username: 'ORYX Bot',
      roleId: '777888999'
    });

    assert.ok(capturedPayload);
    assert.equal(capturedPayload.username, 'ORYX Bot');
    assert.match(capturedPayload.content, /<@&777888999>/);

    const embed = capturedPayload.embeds[0];
    assert.equal(embed.title, '📸 New Instagram Reel / Video');
    assert.equal(embed.url, 'https://instagram.com/p/test1234/');
    assert.equal(embed.color, 0xE1306C);
    assert.equal(embed.image.url, 'https://cdn.instagram.com/thumb.jpg');
    assert.equal(embed.author.name, '@oryx_official');
    assert.ok(embed.description.length <= 650);
    assert.match(embed.description, /Read full caption/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
