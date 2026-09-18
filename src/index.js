import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState, saveState, findNewPosts, buildNextState } from './state.js';
import { fetchRecentMedia, getAccountProfile } from './instagram.js';
import { sendPostNotification } from './discord.js';

// Load .env when running in supported Node environments
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Environment variables can also be supplied directly by the runtime
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_PATH = path.resolve(__dirname, '../data/state.json');

async function run() {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const postLimit = parseInt(process.env.POST_LIMIT || '5', 10);
  const initialNotification = (process.env.INITIAL_NOTIFICATION || 'false').toLowerCase() === 'true';

  const botUsername = process.env.DISCORD_BOT_USERNAME || 'ORYX Social';
  const botAvatarUrl = process.env.DISCORD_BOT_AVATAR_URL;
  const roleId = process.env.DISCORD_ROLE_ID;

  // Validate required configuration
  const missing = [];
  if (!accountId) missing.push('INSTAGRAM_ACCOUNT_ID');
  if (!accessToken) missing.push('INSTAGRAM_ACCESS_TOKEN');
  if (!webhookUrl) missing.push('DISCORD_WEBHOOK_URL');

  if (missing.length > 0) {
    console.error(`[ERROR] Missing required environment variable(s): ${missing.join(', ')}`);
    process.exit(1);
  }

  const state = await loadState(STATE_PATH);

  let accountProfile = null;
  try {
    accountProfile = await getAccountProfile(accountId, accessToken);
    console.log(`[INFO] Connected to Instagram account: @${accountProfile.username || accountId}`);
  } catch (err) {
    console.warn(`[WARN] Could not retrieve account profile (${err.message}). Proceeding with media retrieval.`);
  }

  console.log(`[INFO] Fetching latest ${postLimit} post(s) from Instagram...`);
  const posts = await fetchRecentMedia(accountId, accessToken, postLimit);
  console.log(`[INFO] Retrieved ${posts.length} post(s) from API.`);

  if (posts.length === 0) {
    console.log('[INFO] No posts found for this account.');
    state.last_check_timestamp = new Date().toISOString();
    await saveState(STATE_PATH, state);
    return;
  }

  const isFirstRun = !state.last_post_id && (!state.seen_post_ids || state.seen_post_ids.length === 0);

  if (isFirstRun) {
    console.log('[INFO] Initial run detected. Initializing post history state.');

    if (initialNotification) {
      const latestPost = posts[0];
      console.log(`[INFO] INITIAL_NOTIFICATION enabled: sending notification for latest post: ${latestPost.id}`);
      await sendPostNotification(webhookUrl, latestPost, {
        username: botUsername,
        avatarUrl: botAvatarUrl,
        roleId,
        accountProfile
      });
    }

    const nextState = buildNextState(state, posts);
    await saveState(STATE_PATH, nextState);
    console.log(`[INFO] State initialized with ${nextState.seen_post_ids.length} existing posts.`);
    return;
  }

  const newPosts = findNewPosts(posts, state);

  if (newPosts.length === 0) {
    console.log('[INFO] No new posts detected.');
    state.last_check_timestamp = new Date().toISOString();
    await saveState(STATE_PATH, state);
    return;
  }

  console.log(`[INFO] Detected ${newPosts.length} new post(s). Sending notifications.`);

  for (let i = 0; i < newPosts.length; i++) {
    const post = newPosts[i];
    console.log(`[INFO] Dispatching notification (${i + 1}/${newPosts.length}): ${post.id}`);

    await sendPostNotification(webhookUrl, post, {
      username: botUsername,
      avatarUrl: botAvatarUrl,
      roleId,
      accountProfile
    });

    if (i < newPosts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const nextState = buildNextState(state, newPosts);
  await saveState(STATE_PATH, nextState);
  console.log(`[INFO] State successfully updated. Latest post ID: ${nextState.last_post_id}`);
}

run().catch(err => {
  console.error('[ERROR] Unhandled execution error:', err);
  process.exit(1);
});
