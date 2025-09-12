# Slack Translation Bot

A Slack app that automatically translates messages in channels, threads, or on demand. Built with Bolt for JavaScript and a translation provider (Google Translate, DeepL, OpenAI, etc.).

## Watch the Bot in Action

[![Watch the video](https://img.youtube.com/vi/Znr7fZwMMZk/maxresdefault.jpg)](https://youtu.be/Znr7fZwMMZk)

---

## Features

- 🔄 Auto-translate all new messages in a configured channel between two languages
- 🌐 On-demand translation with `/translate <message>` command
- 🔀 Slash command `/autotranslate on <languages>` or `/autotranslate off` to toggle
- 🤖 Posts translations on behalf of the user who triggered the command
- 🛡️ Ignores bot/system messages and avoids translation loops
- 🌍 Smart language detection - translates to the "other" configured language

---

## Prerequisites

- Node.js (>= 18) and npm/yarn
- Slack workspace with admin rights
- Google Cloud Translate API key

---

## Slack App Setup

1. Go to https://api.slack.com/apps
2. Create New App → From Scratch
3. Add **Bot Token Scopes** under OAuth & Permissions:
   - `chat:write`
   - `chat:write.customize`
   - `channels:history`
   - `channels:read`
   - `channels:join`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:write`
   - `im:read`
   - `mpim:history`
   - `mpim:read`
   - `app_mentions:read`
   - `commands`
4. Add **User Token Scopes** (for posting on behalf of users):
   - `chat:write`
   - `channels:read`
   - `channels:write`
5. Install App to Workspace → copy both Bot User OAuth Token (`xoxb-...`) and User OAuth Token (`xoxp-...`)
6. Under Basic Information → copy the Signing Secret
7. Generate an App-Level Token (Socket Mode) with scope `connections:write` → copy (`xapp-...`)
8. **Important:** After adding new scopes, reinstall the app to apply the updated permissions

---

## Environment Variables

Create a `.env` file with:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
TRANSLATE_API_KEY=your-google-cloud-translate-api-key
```

---

## Install & Run

```bash
git clone https://github.com/BermudaTech/slack-auto-translate-bot
cd slack-auto-translate-bot
npm install
npm start
```

The bot will connect via Socket Mode and listen for messages.

---

## Usage

### Auto-translation setup

**Enable for a channel with two languages:**
```
/autotranslate on english turkish
```
→ Messages in English will be translated to Turkish, messages in Turkish will be translated to English.

**Disable per channel:**
```
/autotranslate off
```

### On-demand translation

**Translate any message:**
```
/translate Hello world
```
→ Posts: 🌐 Merhaba dünya (if channel is configured for English/Turkish)

### How it works

- Detects the language of your input
- Translates to the "other" language configured for the channel
- `/translate`: Posts translation as if you wrote it (appears with your username)
- Auto-translation: Posts translation as a threaded reply from the bot
- Uses 🌐 emoji to indicate it's a translation
- Bot must be invited to channels before enabling auto-translation: `/invite @your-bot-name`

---

## Development Notes

- Uses Google Cloud Translate API (can be swapped for DeepL, AWS Translate, etc.)
- Includes basic error handling and logging
- Channel settings stored in-memory (consider Redis/Postgres for production)
- Language mapping supports both full names ("spanish") and codes ("es")
- Reaction-based triggers and message shortcuts not yet implemented

---

## Roadmap

- Support per-user preferences
- Glossary / custom dictionary
- Admin UI in Slack Home tab
- Multi-language translation in one go
- Ephemeral translations (per user, not public)
