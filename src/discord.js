const INSTAGRAM_COLOR = 0xE1306C;
const DEFAULT_AVATAR = 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/instagram.png';

/**
 * Send an HTTP POST payload to a Discord Webhook.
 * @param {string} webhookUrl
 * @param {object} payload
 * @returns {Promise<boolean>}
 */
export async function postWebhook(webhookUrl, payload) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    throw new Error('[ERROR] Invalid DISCORD_WEBHOOK_URL. URL must begin with https://discord.com/api/webhooks/');
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
    console.warn(`[WARN] Discord rate limit encountered. Retrying in ${delayMs}ms...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return postWebhook(webhookUrl, payload);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`[ERROR] Discord Webhook response HTTP ${res.status}: ${errorText}`);
  }

  return true;
}

/**
 * Format and dispatch an Instagram media notification to Discord.
 * @param {string} webhookUrl
 * @param {object} post Instagram Media object
 * @param {object} [options] Configuration overrides
 * @returns {Promise<boolean>}
 */
export async function sendPostNotification(webhookUrl, post, options = {}) {
  const botUsername = options.username || 'ORYX Social';
  const botAvatar = options.avatarUrl || options.accountProfile?.profile_picture_url || DEFAULT_AVATAR;
  const roleMention = options.roleId ? `<@&${options.roleId}> ` : '';

  const previewImage = post.thumbnail_url || post.media_url || null;

  let typeLabel = 'Post';
  if (post.media_type === 'VIDEO') {
    typeLabel = 'Reel / Video';
  } else if (post.media_type === 'CAROUSEL_ALBUM') {
    typeLabel = 'Carousel Album';
  }

  let captionText = post.caption || '';
  if (captionText.length > 500) {
    captionText = captionText.slice(0, 480) + `... [Read full caption](${post.permalink})`;
  }

  const embed = {
    title: `📸 New Instagram ${typeLabel}`,
    url: post.permalink,
    color: INSTAGRAM_COLOR,
    description: captionText || '*No caption provided.*',
    timestamp: post.timestamp || new Date().toISOString(),
    author: {
      name: post.username ? `@${post.username}` : (options.accountProfile?.username ? `@${options.accountProfile.username}` : 'Instagram'),
      url: post.permalink,
      icon_url: botAvatar
    },
    footer: {
      text: 'Instagram • ORYX Social',
      icon_url: DEFAULT_AVATAR
    }
  };

  if (previewImage) {
    embed.image = { url: previewImage };
  }

  const payload = {
    username: botUsername,
    avatar_url: botAvatar,
    content: roleMention ? `${roleMention}New post alert!` : undefined,
    embeds: [embed]
  };

  return postWebhook(webhookUrl, payload);
}

/**
 * Send a diagnostic verification notification to Discord.
 * @param {string} webhookUrl
 * @param {object} [options]
 * @returns {Promise<boolean>}
 */
export async function sendTestNotification(webhookUrl, options = {}) {
  const botUsername = options.username || 'ORYX Social';
  const botAvatar = options.avatarUrl || DEFAULT_AVATAR;

  const payload = {
    username: botUsername,
    avatar_url: botAvatar,
    embeds: [
      {
        title: '✅ ORYX Social Bot: Webhook Connected',
        description: 'Your Discord Webhook is successfully configured. When new content is published, notifications will appear here automatically.',
        color: 0x2ECC71,
        fields: [
          {
            name: 'Status',
            value: '🟢 Online & Ready',
            inline: true
          },
          {
            name: 'Channel',
            value: 'Verified Webhook',
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'ORYX Social Bot • System Test',
          icon_url: DEFAULT_AVATAR
        }
      }
    ]
  };

  return postWebhook(webhookUrl, payload);
}
