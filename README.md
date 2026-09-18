# ORYX Social Bot

An automated notification service that monitors an Instagram Creator or Business account using Meta's official Graph API and publishes structured notification embeds to a Discord channel via Discord Webhooks.

Designed for serverless execution using GitHub Actions or continuous execution in containerized and local environments.

---

## Overview

ORYX Social Bot polls the Meta Graph API for newly published media (images, videos, reels, and carousel albums) from a specified Instagram account. When new content is detected, the service formats the post caption, media preview, author details, and permalinks into Discord rich embeds and posts them directly to your specified Discord channel via an incoming webhook.

To avoid duplicate notifications, the bot maintains state tracking previously processed media IDs in `data/state.json`. In GitHub Actions workflows, updated state is committed back to the repository automatically.

---

## Features

- **Official Meta Graph API Integration**: Compliant with Meta developer platform policies.
- **Serverless Automation**: Preconfigured GitHub Actions workflow runs on a recurring schedule without requiring self-hosted infrastructure.
- **Rich Embed Notifications**: Displays high-resolution previews, captions, clickable permalinks, and account attribution.
- **Multi-Format Support**: Processes single images, video reels, and carousel albums.
- **Duplicate Prevention**: State tracking persists seen post IDs and prevents repeat alerts.
- **Configurable Mentions**: Optional Discord role mentions for urgent alerts.
- **Diagnostic Utilities**: Built-in CLI tools to validate webhook delivery and inspect or refresh Meta access tokens.

---

## Architecture and Execution Flow

```text
[Instagram / Meta Graph API]
           │
           ▼ (Fetch latest media posts)
    [ORYX Social Bot] ◄───► [data/state.json] (Load & compare post IDs)
           │
           ▼ (Format Discord embed)
  [Discord Webhook API]
           │
           ▼
   [Discord Channel]
```

1. **Trigger**: Scheduled via GitHub Actions cron or invoked locally.
2. **State Retrieval**: Reads `data/state.json` to identify previously seen post IDs.
3. **Media Polling**: Queries the Meta Graph API for the most recent posts.
4. **Diff Detection**: Filters out seen items and sorts new posts in chronological order.
5. **Notification Dispatch**: Posts rich embed messages to the configured Discord Webhook.
6. **State Persistence**: Saves updated post IDs to `data/state.json`.

---

## Prerequisites

- Node.js version 20.0.0 or higher.
- An Instagram Professional Account (Creator or Business).
- A Meta Developer App with Instagram Graph API access.
- A Discord server with permissions to create Webhooks.

---

## Environment Variables

Configure the following variables in your `.env` file for local use, or under GitHub Repository Secrets and Variables for automated workflows.

| Variable Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `INSTAGRAM_ACCOUNT_ID` | Secret | Yes | None | Instagram Business or Creator Account ID. |
| `INSTAGRAM_ACCESS_TOKEN` | Secret | Yes | None | Long-lived Meta User Access Token (valid for 60 days). |
| `DISCORD_WEBHOOK_URL` | Secret | Yes | None | Full Discord Incoming Webhook URL. |
| `DISCORD_BOT_USERNAME` | Variable | No | `ORYX Social` | Username displayed by the Discord webhook. |
| `DISCORD_BOT_AVATAR_URL` | Variable | No | Instagram Icon | Custom avatar image URL for the Discord bot. |
| `DISCORD_ROLE_ID` | Variable | No | None | Discord Role ID to ping with notifications (e.g. `123456789012345678`). |
| `INITIAL_NOTIFICATION` | Variable | No | `false` | If `true`, sends an alert for the latest existing post on initial setup. |
| `POST_LIMIT` | Variable | No | `5` | Maximum number of recent posts retrieved per check. |

---

## Setup Guide

### 1. Instagram Account Configuration

1. In the Instagram mobile application, navigate to **Settings and privacy** > **Account type and tools**.
2. Select **Switch to professional account** and select either **Creator** or **Business**.
3. In Meta Accounts Center, link the Instagram account to a Facebook Page to allow Graph API access.

### 2. Meta API Credentials

1. Go to the [Meta for Developers](https://developers.facebook.com/) portal and create an application.
2. Add the **Instagram Graph API** product to your application.
3. Generate a User Access Token with `instagram_basic` permissions.
4. Exchange the short-lived token for a long-lived access token (valid for 60 days).
5. Retrieve your Instagram Account ID using the Graph API Explorer.

### 3. Discord Webhook Setup

1. In your Discord server, open the target channel settings.
2. Select **Integrations** > **Webhooks** > **New Webhook**.
3. Name your webhook and copy the generated Webhook URL.

---

## Local Development and Verification

### Installation

Clone the repository and verify your Node.js runtime:

```bash
node -v  # Requires >= 20.0.0
```

### Configuration

Copy `.env.example` to `.env` and provide your credentials:

```bash
cp .env.example .env
```

### Diagnostics

Verify Discord webhook connectivity:

```bash
npm run test:webhook
# Or provide a direct URL:
node src/scripts/test-webhook.js https://discord.com/api/webhooks/...
```

Inspect Meta token expiration and account permissions:

```bash
npm run check:token
# Or refresh an existing long-lived token:
node src/scripts/check-token.js --refresh
```

### Run Bot Manually

```bash
npm start
```

### Unit Tests

Run the built-in Node.js test suite:

```bash
npm test
# Or run tests directly with Node:
node --test test/*.test.js
```

---

## GitHub Actions Deployment

The repository includes a ready-to-use workflow at `.github/workflows/instagram-discord.yml`.

### Secrets and Variables Setup

1. In your GitHub repository, navigate to **Settings** > **Secrets and variables** > **Actions**.
2. Under **Repository secrets**, add:
   - `INSTAGRAM_ACCOUNT_ID`
   - `INSTAGRAM_ACCESS_TOKEN`
   - `DISCORD_WEBHOOK_URL`
3. Under **Repository variables**, optionally add:
   - `DISCORD_BOT_USERNAME`
   - `DISCORD_BOT_AVATAR_URL`
   - `DISCORD_ROLE_ID`
   - `INITIAL_NOTIFICATION`
   - `POST_LIMIT`

### Workflow Permissions

The workflow commits state changes to `data/state.json` to prevent duplicate alerts across runs.

1. Navigate to **Settings** > **Actions** > **General**.
2. Under **Workflow permissions**, select **Read and write permissions**.
3. Save changes.

### Scheduling Behavior

The workflow schedule is configured with cron `* * * * *`. Note that GitHub Actions enforces platform-level queue constraints:
- Scheduled workflow triggers typically run at minimum intervals of approximately 5 minutes.
- High platform demand may result in execution variance.
- Manual execution is always available via the **Run workflow** button in the Actions tab.

---

## Project Structure

```text
├── .github/
│   └── workflows/
│       └── instagram-discord.yml  # Scheduled GitHub Actions workflow
├── data/
│   └── state.json                 # Persistent post tracking state
├── src/
│   ├── discord.js                 # Discord Webhook client and embed builder
│   ├── index.js                   # Application coordinator
│   ├── instagram.js               # Meta Graph API integration
│   ├── state.js                   # State management and diff filtering
│   └── scripts/
│       ├── check-token.js         # Token inspection and refresh utility
│       └── test-webhook.js        # Discord webhook diagnostic tool
├── test/
│   ├── discord.test.js            # Discord payload unit tests
│   └── state.test.js              # State persistence and sorting unit tests
├── .env.example                   # Environment configuration template
├── .gitignore
├── package.json
└── README.md
```

---

## Token Maintenance

Meta long-lived access tokens remain valid for 60 days. To inspect remaining validity or renew a token, run:

```bash
node src/scripts/check-token.js --refresh
```

After refreshing, update the `INSTAGRAM_ACCESS_TOKEN` secret in your GitHub repository settings.

---

## License

This project is licensed under the MIT License.
