# Slack Auto-Translate Bot

A powerful Slack bot that provides automatic message translation with both channel-wide and individual user settings. Messages can be translated publicly for all channel members or privately for individual users only.

## Watch the Bot in Action

[![Watch the video](https://img.youtube.com/vi/Znr7fZwMMZk/maxresdefault.jpg)](https://youtu.be/Znr7fZwMMZk)

---

## Features

### 🌍 Dual Translation Modes
- **Channel-Level Auto-Translate**: Public translations visible to everyone in the channel
- **Individual Auto-Translate**: Private translations visible only to specific users via ephemeral messages
- **On-Demand Translation**: Translate specific messages immediately

### 🚀 Performance Optimizations
- Language detection caching to reduce API calls
- Parallel translation processing for multiple users
- Smart filtering to avoid unnecessary translations
- LRU cache with configurable TTL

### 🎯 User Experience
- Language flag emojis for visual language identification (🇪🇸 🇫🇷 🇩🇪 etc.)
- Comprehensive help commands with language codes
- Status checking and management
- Backwards compatibility with existing channel setups

### 🛡️ Smart Features
- Emoji-only message filtering
- Translation loop prevention
- Bot message filtering
- Identical translation detection

---

## Commands

### Channel-Level Commands (Public)

#### `/autotranslate`
Manages translation settings for entire channels. Translations are posted as public threaded replies.

```
/autotranslate on                        # Default: English + Turkish
/autotranslate on english spanish        # Translate between English and Spanish
/autotranslate on turkish french german  # Multi-language support
/autotranslate off                       # Disable channel translation
```

**How it works:**
- Bot detects message language automatically
- Translates to the "other" configured language
- Posts as threaded reply with sender's avatar and username
- Visible to all channel members

### Individual Commands (Private)

#### `/autotranslate-me`
⭐ **NEW!** Manages personal translation settings. Translations are sent as ephemeral messages visible only to you.

```
/autotranslate-me on [language]      # Enable personal auto-translate
/autotranslate-me on spanish         # Receive private Spanish translations
/autotranslate-me on                 # Default: English translations
/autotranslate-me off               # Disable personal auto-translate
/autotranslate-me status            # Check your current settings
/autotranslate-me                   # Show help with available languages
```

**How it works:**
- You receive private translations for all messages in channels you're in
- Only translates when source language differs from your target language
- Shows: `🇪🇸 **username**: Translated message content`
- Completely private - other users can't see your translations

### On-Demand Translation

#### `/translate`
Translate a specific message immediately to the channel's target language.

```
/translate Hello everyone!          # Translates and posts publicly
/translate Bonjour tout le monde!   # Auto-detects French, translates to target
```

---

## Supported Languages

| Language | Code | Flag | Language | Code | Flag |
|----------|------|------|----------|------|------|
| English | `en` | 🇺🇸 | Italian | `it` | 🇮🇹 |
| Spanish | `es` | 🇪🇸 | Portuguese | `pt` | 🇵🇹 |
| French | `fr` | 🇫🇷 | Russian | `ru` | 🇷🇺 |
| German | `de` | 🇩🇪 | Japanese | `ja` | 🇯🇵 |
| Turkish | `tr` | 🇹🇷 | Korean | `ko` | 🇰🇷 |
| Chinese | `zh` | 🇨🇳 | Arabic | `ar` | 🇸🇦 |

---

## Usage Examples

### Scenario 1: Multilingual Team Channel
```bash
# Admin sets up public channel translation
/autotranslate on english spanish

# Team members set up their personal preferences
User A: /autotranslate-me on french    # Gets private French translations
User B: /autotranslate-me on german    # Gets private German translations
User C: /autotranslate-me off          # No personal translations
```

**Result:**
- **Public**: English ↔ Spanish translations visible to everyone
- **Private**: User A sees French translations, User B sees German translations
- **User C**: Only sees public English/Spanish translations

### Scenario 2: Personal-Only Translation
```bash
# No channel-level translation set up
# Individual users enable personal translation
/autotranslate-me on japanese
```

**Result:**
- User privately receives Japanese translations of all messages
- No public translations in the channel
- Other users see original messages only

### Scenario 3: On-Demand Usage
```bash
/translate Hola, ¿cómo están todos?
# Bot posts: 🌐 Hello, how is everyone?
```

---

## Prerequisites

- Node.js (>= 18) and npm
- Slack workspace with admin rights
- Google Cloud Translate API key

---

## Slack App Setup

1. Go to https://api.slack.com/apps
2. Create New App → From Scratch
3. Add **Bot Token Scopes** under OAuth & Permissions:
   - `chat:write`
   - `chat:write.public`
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
   - `users:read`

4. Add **User Token Scopes** (for posting on behalf of users):
   - `chat:write`
   - `channels:read`
   - `channels:write`

5. Add **Slash Commands:**
   - `/autotranslate` - Manage channel translation settings
   - `/autotranslate-me` - Manage personal translation settings
   - `/translate` - Translate message on-demand

6. Install App to Workspace → copy both tokens
7. Under Basic Information → copy the Signing Secret
8. Generate an App-Level Token (Socket Mode) with scope `connections:write`
9. **Important:** After adding new scopes, reinstall the app

---

## Installation & Setup

### Environment Variables

Create a `.env` file:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_USER_TOKEN=xoxp-your-user-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
TRANSLATE_API_KEY=your-google-cloud-translate-api-key
PORT=3000
```

### Install & Run

```bash
git clone <repository-url>
cd slack-translate-app
npm install
npm start
```

### Development Mode
```bash
npm run dev    # Uses nodemon for auto-restart
```

---

## Configuration

Settings are automatically saved to `config.json`:

```json
{
  "channelSettings": {
    "C1234567890": {
      "enabled": true,
      "activeLanguages": ["en", "es"]
    }
  },
  "userSettings": {
    "U1234567890": {
      "enabled": true,
      "targetLanguage": "es"
    },
    "U0987654321": {
      "enabled": false,
      "targetLanguage": "fr"
    }
  }
}
```

### Cache Configuration

The bot includes configurable caching:

```javascript
const CACHE_TTL = 60000;        // 1 minute cache
const MAX_CACHE_SIZE = 500;     // Maximum cached entries
```

---

## Architecture & Performance

### Caching System
- **Language Detection Cache**: Prevents redundant API calls for similar messages
- **LRU Eviction**: Maintains cache size limits
- **TTL-based**: Cache entries expire after 1 minute

### Translation Processing
- **Parallel Processing**: Multiple user translations processed simultaneously
- **Smart Filtering**: Skips unnecessary translations
- **Error Handling**: Individual user translation failures don't affect others

### Message Flow
1. **Message Received** → Bot processes all messages in channels it's added to
2. **Language Detection** → Cached first, then API call if needed
3. **Channel Translation** → If enabled, posts public threaded reply
4. **Individual Translation** → Processes all users with auto-translate enabled
5. **Ephemeral Delivery** → Sends private translations to specific users

---

## Privacy & Security

- **Individual translations are completely private**: Ephemeral messages visible only to requesting user
- **No message content storage**: Bot only caches language detection, not message text
- **Local configuration storage**: Settings stored in local `config.json`
- **Secure API handling**: Translation API keys properly protected
- **Smart filtering**: Prevents translation loops and unnecessary API calls

---

## Troubleshooting

### Bot Not Responding
- ✅ Ensure bot is invited to the channel: `/invite @your-bot-name`
- ✅ Check bot has required permissions
- ✅ Verify environment variables are set correctly
- ✅ Check console logs for connection errors

### Translation Not Working
- ✅ Verify Google Translate API key is valid
- ✅ Check API quotas and billing
- ✅ Review console logs for API errors
- ✅ Test with simple messages first

### Ephemeral Messages Not Appearing
- ✅ User must be in the channel where message was posted
- ✅ Check if user has `/autotranslate-me` enabled
- ✅ Verify Slack app has `chat:write` scope
- ✅ Test with `/autotranslate-me status` command

### Performance Issues
- ✅ Check cache hit rates in logs
- ✅ Monitor API rate limits
- ✅ Consider increasing cache TTL for high-traffic channels

---

## API Limits & Costs

### Google Translate API
- **Pricing**: ~$20 per 1M characters
- **Rate Limits**: 1000 requests per 100 seconds per user
- **Cache Benefits**: Reduces API calls by ~30-50% in active channels

### Optimization Tips
- Cache hit rate improves with channel activity
- Emoji-only messages are automatically skipped
- Identical translations are prevented

---

## Development

### Project Structure
```
slack-translate-app/
├── index.js              # Main application file
├── translateService.js   # Google Translate API wrapper
├── config.json          # Settings storage (auto-created)
├── package.json         # Dependencies and scripts
├── .env                 # Environment variables
└── README.md           # Documentation
```

### Key Functions
- `getUsersWithAutoTranslate()` - Gets users with personal auto-translate enabled
- `getCachedDetection()` - Language detection cache lookup
- `saveSettings()` - Persists configuration to file

### Adding New Languages
1. Add language code to `languageFlags` object
2. Add mapping in `translateService.js` `getLanguageCode()`
3. Update documentation

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup
```bash
npm run dev    # Start with auto-reload
npm test       # Run tests (when available)
```

---

## Roadmap

- ✅ ~~Support per-user preferences~~ **COMPLETED**
- ✅ ~~Ephemeral translations (private)~~ **COMPLETED**
- ✅ ~~Performance optimizations~~ **COMPLETED**
- 🔄 Thread/channel summary with translation
- 🔄 Admin UI in Slack Home tab
- 🔄 Glossary / custom dictionary support
- 🔄 Translation quality feedback
- 🔄 Usage analytics and reporting

---

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section above
- Review console logs for detailed error information
- Create an issue in the repository with:
  - Steps to reproduce
  - Console log output
  - Environment details

---

**Made with ❤️ for multilingual teams worldwide 🌍**