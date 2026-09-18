import { inspectToken, refreshLongLivedToken, getAccountProfile } from '../instagram.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // Environment variables can also be provided directly via runtime
  }
}

async function main() {
  const argToken = process.argv[2];
  const token = (argToken && (argToken.startsWith('IGAA') || argToken.startsWith('EAA'))) ? argToken : process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const shouldRefresh = process.argv.includes('--refresh');

  console.log('--- Meta Token Inspector ---');

  if (!token) {
    console.error('[ERROR] No INSTAGRAM_ACCESS_TOKEN found.');
    console.error('Usage:');
    console.error('  1. Configure INSTAGRAM_ACCESS_TOKEN in your .env file, or');
    console.error('  2. Run: node src/scripts/check-token.js <token>');
    process.exit(1);
  }

  try {
    console.log('[INFO] Inspecting token via Meta Graph API...');
    const info = await inspectToken(token);

    console.log(`\nStatus:         ${info.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`App ID:         ${info.appId || 'N/A'}`);
    console.log(`Token Type:     ${info.type || 'N/A'}`);
    console.log(`Expires At:     ${info.expiresAt}`);
    console.log(`Days Remaining: ${info.daysRemaining !== null ? `${info.daysRemaining} days` : 'N/A'}`);
    console.log(`Permissions:    ${info.scopes?.join(', ') || 'None'}`);

    if (accountId) {
      console.log('\n[INFO] Validating account profile connection...');
      try {
        const profile = await getAccountProfile(accountId, token);
        console.log(`Profile:        @${profile.username || profile.id} (${profile.name || 'No name set'})`);
      } catch (err) {
        console.warn(`[WARN] Account lookup note: ${err.message}`);
      }
    }

    if (shouldRefresh) {
      console.log('\n[INFO] Attempting to refresh long-lived token...');
      try {
        const refreshed = await refreshLongLivedToken(token);
        console.log('[INFO] Token refresh successful.');
        console.log(`New Token:      ${refreshed.access_token}`);
        console.log(`Expires in:     ${Math.round(refreshed.expires_in / 86400)} days`);
      } catch (err) {
        console.error('[ERROR] Refresh failed:', err.message);
        console.log('Note: Meta allows refreshing tokens that are at least 24 hours old.');
      }
    } else if (info.daysRemaining !== null && info.daysRemaining < 14) {
      console.log('\n[WARN] Token expires in less than 14 days.');
      console.log('Run `node src/scripts/check-token.js --refresh` to request an extension.');
    }
  } catch (err) {
    console.error('[ERROR] Token inspection failed:', err.message);
    process.exit(1);
  }
}

main();
