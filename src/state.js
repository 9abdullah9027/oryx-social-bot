import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_STATE = {
  last_post_id: null,
  last_post_timestamp: null,
  last_check_timestamp: null,
  seen_post_ids: []
};

/**
 * Load state from disk or initialize default state if missing.
 * @param {string} statePath
 * @returns {Promise<{last_post_id: string|null, last_post_timestamp: string|null, last_check_timestamp: string|null, seen_post_ids: string[]}>}
 */
export async function loadState(statePath) {
  try {
    const raw = await fs.readFile(statePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      last_post_id: parsed.last_post_id ?? null,
      last_post_timestamp: parsed.last_post_timestamp ?? null,
      last_check_timestamp: parsed.last_check_timestamp ?? null,
      seen_post_ids: Array.isArray(parsed.seen_post_ids) ? parsed.seen_post_ids : []
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await saveState(statePath, DEFAULT_STATE);
      return { ...DEFAULT_STATE };
    }
    console.warn(`[WARN] Failed reading state from ${statePath}, resetting to defaults:`, err.message);
    return { ...DEFAULT_STATE };
  }
}

/**
 * Persist state to disk.
 * @param {string} statePath
 * @param {object} state
 * @returns {Promise<void>}
 */
export async function saveState(statePath, state) {
  const dir = path.dirname(statePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

/**
 * Filter posts to find unseen entries ordered chronologically from oldest to newest.
 * @param {Array<object>} posts
 * @param {object} state
 * @returns {Array<object>}
 */
export function findNewPosts(posts, state) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const seenSet = new Set(state.seen_post_ids || []);
  if (state.last_post_id) {
    seenSet.add(state.last_post_id);
  }

  const unseen = posts.filter(post => post?.id && !seenSet.has(post.id));

  return unseen.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Return updated state containing newly processed posts with trimmed history.
 * @param {object} currentState
 * @param {Array<object>} processedPosts
 * @param {number} [maxHistory=30]
 * @returns {object}
 */
export function buildNextState(currentState, processedPosts, maxHistory = 30) {
  const seen = new Set(currentState.seen_post_ids || []);
  let latestPostId = currentState.last_post_id;
  let latestPostTimestamp = currentState.last_post_timestamp;

  for (const post of processedPosts) {
    seen.add(post.id);
    if (!latestPostTimestamp || new Date(post.timestamp).getTime() > new Date(latestPostTimestamp).getTime()) {
      latestPostId = post.id;
      latestPostTimestamp = post.timestamp;
    }
  }

  const seenArray = Array.from(seen).slice(-maxHistory);

  return {
    last_post_id: latestPostId,
    last_post_timestamp: latestPostTimestamp,
    last_check_timestamp: new Date().toISOString(),
    seen_post_ids: seenArray
  };
}
