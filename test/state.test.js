import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findNewPosts, buildNextState, loadState, saveState } from '../src/state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_STATE_PATH = path.resolve(__dirname, 'temp_state.json');

test('findNewPosts returns empty array when given empty posts', () => {
  const state = { last_post_id: '123', seen_post_ids: ['123'] };
  const newPosts = findNewPosts([], state);
  assert.deepEqual(newPosts, []);
});

test('findNewPosts detects and chronologically orders unseen posts', () => {
  const state = {
    last_post_id: '100',
    seen_post_ids: ['100']
  };

  const incomingPosts = [
    { id: '103', timestamp: '2026-09-18T12:00:00Z', caption: 'Latest' },
    { id: '102', timestamp: '2026-09-18T11:00:00Z', caption: 'Middle' },
    { id: '100', timestamp: '2026-09-18T09:00:00Z', caption: 'Old Already Seen' }
  ];

  const newPosts = findNewPosts(incomingPosts, state);

  assert.equal(newPosts.length, 2);
  // Chronological order: 102 first, then 103
  assert.equal(newPosts[0].id, '102');
  assert.equal(newPosts[1].id, '103');
});

test('buildNextState correctly updates latest post and trims history', () => {
  const state = {
    last_post_id: '100',
    last_post_timestamp: '2026-09-18T09:00:00Z',
    seen_post_ids: ['99', '100']
  };

  const processed = [
    { id: '101', timestamp: '2026-09-18T10:00:00Z' },
    { id: '102', timestamp: '2026-09-18T11:00:00Z' }
  ];

  const next = buildNextState(state, processed, 3);

  assert.equal(next.last_post_id, '102');
  assert.equal(next.last_post_timestamp, '2026-09-18T11:00:00Z');
  assert.ok(next.last_check_timestamp);
  // Max history of 3 should trim to 3 elements
  assert.equal(next.seen_post_ids.length, 3);
  assert.deepEqual(next.seen_post_ids, ['100', '101', '102']);
});

test('loadState and saveState round-trip successfully', async () => {
  try {
    const sampleState = {
      last_post_id: 'test_id_999',
      last_post_timestamp: '2026-09-18T14:00:00Z',
      last_check_timestamp: '2026-09-18T14:05:00Z',
      seen_post_ids: ['test_id_999']
    };

    await saveState(TEMP_STATE_PATH, sampleState);
    const loaded = await loadState(TEMP_STATE_PATH);

    assert.equal(loaded.last_post_id, sampleState.last_post_id);
    assert.equal(loaded.last_post_timestamp, sampleState.last_post_timestamp);
    assert.deepEqual(loaded.seen_post_ids, sampleState.seen_post_ids);
  } finally {
    await fs.unlink(TEMP_STATE_PATH).catch(() => {});
  }
});
