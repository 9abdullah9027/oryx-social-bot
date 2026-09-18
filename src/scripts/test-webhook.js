import { sendTestNotification } from '../discord.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Environment variables can also be provided directly via runtime
  }
}

async function main() {
  const webhookUrl = process.argv[2] || process.env.DISCORD_WEBHOOK_URL;

  console.log('--- Discord Webhook Diagnostic ---');

  if (!webhookUrl) {
    console.error('[ERROR] No Discord Webhook URL found.');
    console.error('Usage:');
    console.error('  1. Configure DISCORD_WEBHOOK_URL in your .env file, or');
    console.error('  2. Run: node src/scripts/test-webhook.js <webhook_url>');
    process.exit(1);
  }

  console.log(`Target Webhook: ${webhookUrl.slice(0, 35)}...`);
  console.log('[INFO] Sending test notification...');

  try {
    await sendTestNotification(webhookUrl, {
      username: process.env.DISCORD_BOT_USERNAME || 'ORYX Social',
      avatarUrl: process.env.DISCORD_BOT_AVATAR_URL
    });
    console.log('[INFO] Test notification sent successfully to Discord.');
  } catch (err) {
    console.error('[ERROR] Failed to send test notification:', err.message);
    process.exit(1);
  }
}

main();
