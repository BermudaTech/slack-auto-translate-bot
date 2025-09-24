require('dotenv').config();
const { App } = require('@slack/bolt');
const TranslateService = require('./translateService');

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    port: process.env.PORT || 3000
});

// Create a separate client with user token for posting on behalf of user
const { WebClient } = require('@slack/web-api');
const userClient = new WebClient(process.env.SLACK_USER_TOKEN);

const translateService = new TranslateService(process.env.TRANSLATE_API_KEY);

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

// Load settings from config file
function loadSettings() {
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return {
                channelSettings: new Map(Object.entries(config.channelSettings || {})),
                userSettings: new Map(Object.entries(config.userSettings || {}))
            };
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
    return {
        channelSettings: new Map(),
        userSettings: new Map()
    };
}

// Save settings to config file
function saveSettings(channelSettings, userSettings) {
    try {
        const config = {
            channelSettings: Object.fromEntries(channelSettings),
            userSettings: Object.fromEntries(userSettings)
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('💾 Settings saved');
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Load user settings for a specific user
function getUserSettings(userId) {
    return userSettings.get(userId) || { enabled: false, targetLanguage: 'en' };
}

// Save user settings for a specific user
function setUserSettings(userId, settings) {
    userSettings.set(userId, settings);
    saveSettings(channelSettings, userSettings);
}

// Get users who have auto-translate enabled for a channel
function getUsersWithAutoTranslate(channelId) {
    const usersWithAutoTranslate = [];
    for (const [userId, settings] of userSettings) {
        if (settings.enabled) {
            // Check if user has channel-specific settings or global settings
            const effectiveSettings = settings.channels?.[channelId] || settings;
            if (effectiveSettings.enabled !== false) {
                usersWithAutoTranslate.push({
                    userId,
                    targetLanguage: effectiveSettings.targetLanguage || settings.targetLanguage
                });
            }
        }
    }
    return usersWithAutoTranslate;
}

const { channelSettings, userSettings } = loadSettings();

// Simple cache for language detection to avoid redundant API calls
const detectionCache = new Map();
const CACHE_TTL = 60000; // 1 minute
const MAX_CACHE_SIZE = 500;

function getCachedDetection(text) {
    const key = text.toLowerCase().trim();
    const cached = detectionCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.language;
    }
    return null;
}

function setCachedDetection(text, language) {
    const key = text.toLowerCase().trim();

    // Implement simple LRU by clearing cache when it gets too large
    if (detectionCache.size >= MAX_CACHE_SIZE) {
        const firstKey = detectionCache.keys().next().value;
        detectionCache.delete(firstKey);
    }

    detectionCache.set(key, {
        language: language,
        timestamp: Date.now()
    });
}

// Language flag emojis
const languageFlags = {
    'en': '🇺🇸',
    'tr': '🇹🇷',
    'es': '🇪🇸',
    'fr': '🇫🇷',
    'de': '🇩🇪',
    'it': '🇮🇹',
    'pt': '🇵🇹',
    'ru': '🇷🇺',
    'ja': '🇯🇵',
    'ko': '🇰🇷',
    'zh': '🇨🇳',
    'ar': '🇸🇦'
};

// Helper function to check if text contains only emojis, whitespace, or is empty
function isEmojiOnly(text) {
    if (!text || !text.trim()) return true;
    
    // Remove Slack text emojis (like :smile:, :slightly_smiling_face:)
    let textWithoutSlackEmojis = text.replace(/:[a-zA-Z0-9_+-]+:/g, '');
    
    // Remove all Unicode emojis, whitespace, and common punctuation
    const textWithoutEmojis = textWithoutSlackEmojis
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport
        .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical Symbols
        .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric Shapes Extended
        .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows-C
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
        .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
        .replace(/\s+/g, '')                    // Whitespace
        .replace(/[.,!?;:]/g, '');              // Basic punctuation
    
    return textWithoutEmojis.length === 0;
}

// Helper function to normalize text for comparison
function normalizeText(text) {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

app.message(async ({ message, client }) => {
    console.log('📩 Message received:', {
        text: message.text,
        channel: message.channel,
        user: message.user,
        subtype: message.subtype,
        bot_id: message.bot_id,
        full_message: JSON.stringify(message, null, 2)
    });

    if (message.bot_id || (message.subtype && message.subtype !== 'file_share')) {
        console.log('⏭️ Skipping bot/system message');
        return;
    }

    // Skip messages that start with our translation emoji to avoid loops
    if (message.text && (message.text.startsWith('🌐') || message.text.startsWith(':globe_with_meridians:'))) {
        console.log('⏭️ Skipping translated message to avoid loop');
        return;
    }

    // Skip emoji-only messages
    if (isEmojiOnly(message.text)) {
        console.log('⏭️ Skipping emoji-only message');
        return;
    }

    const channelId = message.channel;
    const settings = channelSettings.get(channelId);

    console.log('⚙️ Channel settings:', settings);

    // Check for both channel-level and individual user auto-translate
    const channelEnabled = settings && settings.enabled;
    const usersWithAutoTranslate = getUsersWithAutoTranslate(channelId);

    console.log('👥 Users with auto-translate:', usersWithAutoTranslate);
    console.log('📊 Total user settings:', userSettings.size);
    console.log('🔧 All user settings:', Object.fromEntries(userSettings));

    if (!channelEnabled && usersWithAutoTranslate.length === 0) {
        console.log('❌ Translation not enabled for this channel or any users');
        return;
    }

    try {
        // Check cache first, then detect source language
        let detectedLanguage = getCachedDetection(message.text);
        if (!detectedLanguage) {
            const [detection] = await translateService.translate.detect(message.text);
            detectedLanguage = detection.language;
            setCachedDetection(message.text, detectedLanguage);
            console.log('🔍 Detected language (API):', detectedLanguage);
        } else {
            console.log('🔍 Detected language (cached):', detectedLanguage);
        }

        // Handle channel-level auto-translate (existing functionality)
        if (channelEnabled) {
            const activeLanguages = settings.activeLanguages || ['en', 'tr'];
            const targetLang = activeLanguages.find(lang => lang !== detectedLanguage);

            if (targetLang) {
                const result = await translateService.translateText(message.text, targetLang);

                if (normalizeText(result.translatedText) !== normalizeText(message.text)) {
                    const userInfo = await client.users.info({ user: message.user });
                    const username = userInfo.user.name;
                    const userAvatar = userInfo.user.profile.image_24;

                    await client.chat.postMessage({
                        channel: channelId,
                        thread_ts: message.ts,
                        blocks: [
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "image",
                                        image_url: userAvatar,
                                        alt_text: username
                                    },
                                    {
                                        type: "mrkdwn",
                                        text: `${username} :globe_with_meridians: ${result.translatedText}`
                                    }
                                ]
                            }
                        ]
                    });
                }
            }
        }

        // Handle individual user auto-translate (new functionality)
        if (usersWithAutoTranslate.length > 0) {
            const translationPromises = [];
            const userInfo = await client.users.info({ user: message.user });
            const username = userInfo.user.name;

            for (const userConfig of usersWithAutoTranslate) {
                // Skip if user is the message sender
                if (userConfig.userId === message.user) {
                    console.log(`⏭️ Skipping translation for message sender ${userConfig.userId}`);
                    continue;
                }

                // Skip if target language is same as detected language
                if (userConfig.targetLanguage === detectedLanguage) {
                    console.log(`⏭️ Skipping translation for ${userConfig.userId} - target language ${userConfig.targetLanguage} matches detected ${detectedLanguage}`);
                    continue;
                }

                // Create translation promise
                translationPromises.push(
                    translateService.translateText(message.text, userConfig.targetLanguage)
                        .then(async (result) => {
                            // Check if translation is meaningful
                            if (normalizeText(result.translatedText) === normalizeText(message.text)) {
                                return;
                            }

                            // Send ephemeral message to the specific user
                            const flagEmoji = languageFlags[userConfig.targetLanguage] || '🌐';
                            await client.chat.postEphemeral({
                                channel: channelId,
                                user: userConfig.userId,
                                text: `${flagEmoji} *${username}*: ${result.translatedText}`
                            });
                        })
                        .catch(error => {
                            console.error(`Translation failed for user ${userConfig.userId}:`, error);
                        })
                );
            }

            // Execute all translations in parallel
            await Promise.all(translationPromises);
        }

    } catch (error) {
        console.error('Translation failed:', error);

        // Only show error in channel if channel-level translation is enabled
        if (channelEnabled) {
            await client.chat.postMessage({
                channel: channelId,
                thread_ts: message.ts,
                text: '⚠️ Translation failed. Please try again later.'
            });
        }
    }
});

app.command('/autotranslate', async ({ command, ack, respond, client }) => {
    await ack();
    
    console.log('🔧 Slash command received:', command);
    
    const { channel_id, text } = command;
    const args = text.trim().split(' ');
    
    if (args[0] === 'on') {
        try {
            // Check if bot is in the channel/DM/group by trying to get channel info
            await client.conversations.info({
                channel: channel_id
            });
        } catch (error) {
            console.log('❌ Bot not in channel/DM:', channel_id, error.data?.error);
            
            const isDM = channel_id.startsWith('D');
            const isGroupDM = command.channel_name && command.channel_name.startsWith('mpdm-');
            
            if (isDM) {
                await respond({
                    text: '⚠️ Please message the bot directly first to enable DM translation.',
                    response_type: 'ephemeral'
                });
            } else if (isGroupDM) {
                await respond({
                    text: '⚠️ Bot needs proper permissions for group DMs. Please check app permissions.',
                    response_type: 'ephemeral'
                });
            } else {
                await respond({
                    text: '⚠️ Bot needs to be added to this channel first. Please invite @TranslateBot to the channel before enabling auto-translation.',
                    response_type: 'ephemeral'
                });
            }
            return;
        }
        
        let activeLanguages;
        
        if (args.length > 1) {
            // Parse multiple languages: /autotranslate on english turkish spanish
            activeLanguages = args.slice(1).map(lang => translateService.getLanguageCode(lang));
        } else {
            // Default to English and Turkish
            activeLanguages = ['en', 'tr'];
        }
        
        channelSettings.set(channel_id, { 
            enabled: true, 
            activeLanguages: activeLanguages
        });
        
        saveSettings(channelSettings, userSettings);
        
        console.log('✅ Translation enabled for channel:', channel_id, 'Languages:', activeLanguages);
        
        await client.chat.postMessage({
            channel: channel_id,
            text: `✅ Auto-translation enabled for this channel. Active languages: ${activeLanguages.join(', ')}`
        });
    } else if (args[0] === 'off') {
        channelSettings.delete(channel_id);
        
        saveSettings(channelSettings, userSettings);
        
        console.log('❌ Translation disabled for channel:', channel_id);
        
        await client.chat.postMessage({
            channel: channel_id,
            text: '❌ Auto-translation disabled for this channel'
        });
    } else {
        await respond({
            text: 'Usage: `/autotranslate on [languages...]` or `/autotranslate off`\nExamples:\n• `/autotranslate on` (defaults to English + Turkish)\n• `/autotranslate on english spanish`\n• `/autotranslate on turkish french german`',
            response_type: 'ephemeral'
        });
    }
});

// New slash command for direct translation
app.command('/translate', async ({ command, ack, respond, client }) => {
    await ack();
    
    console.log('🌍 Translate command received:', command);
    
    const { channel_id, text, user_id } = command;
    
    if (!text.trim()) {
        await respond({
            text: 'Usage: `/translate <message>`\nExample: `/translate Hello everyone!`',
            response_type: 'ephemeral'
        });
        return;
    }
    
    // Skip emoji-only messages
    if (isEmojiOnly(text)) {
        await respond({
            text: '⏭️ Cannot translate emoji-only messages',
            response_type: 'ephemeral'
        });
        return;
    }
    
    try {
        // Get channel settings to determine active languages
        const settings = channelSettings.get(channel_id);
        const activeLanguages = settings?.activeLanguages || ['en', 'tr'];
        
        // Detect source language
        const [detection] = await translateService.translate.detect(text);
        const detectedLanguage = detection.language;
        
        console.log('🔍 Direct translate - detected language:', detectedLanguage);
        
        // Find the target language (the other language that's not the detected one)
        const targetLang = activeLanguages.find(lang => lang !== detectedLanguage);
        
        if (targetLang) {
            const result = await translateService.translateText(text, targetLang);
            
            try {
                await userClient.chat.postMessage({
                    channel: channel_id,
                    text: `🌐 ${result.translatedText}`
                });
            } catch (postError) {
                console.error('Failed to post translation to channel:', postError);
                // Fallback: send as ephemeral response if channel posting fails
                await respond({
                    text: `⚠️ Could not post to channel. Translation: 🌐 ${result.translatedText}`,
                    response_type: 'ephemeral'
                });
            }
        } else {
            await respond({
                text: `✅ Text is already in the target language(s): ${activeLanguages.join(', ')}`,
                response_type: 'ephemeral'
            });
        }
        
    } catch (error) {
        console.error('Direct translation failed:', error);
        
        await respond({
            text: '⚠️ Translation failed. Please try again later.',
            response_type: 'ephemeral'
        });
    }
});

// New slash command for personal auto-translate settings
app.command('/autotranslate-me', async ({ command, ack, respond, client }) => {
    await ack();

    console.log('👤 Personal auto-translate command received:', command);

    const { user_id, text } = command;
    const args = text.trim().split(' ');

    if (args[0] === 'on') {
        let targetLanguage = 'en'; // default

        if (args.length > 1) {
            targetLanguage = translateService.getLanguageCode(args[1]);
        }

        // Get current user settings
        const currentSettings = getUserSettings(user_id);

        // Update settings
        const newSettings = {
            ...currentSettings,
            enabled: true,
            targetLanguage: targetLanguage
        };
        setUserSettings(user_id, newSettings);

        console.log(`✅ Personal auto-translate enabled for user ${user_id} to language: ${targetLanguage}`);
        console.log('📋 Updated user settings:', newSettings);
        console.log('🗂️ All user settings after update:', Object.fromEntries(userSettings));

        await respond({
            text: `✅ Personal auto-translate enabled! You'll now receive translations to *${targetLanguage}* for messages in all channels (visible only to you).\n\nTo disable: \`/autotranslate-me off\`\nTo change language: \`/autotranslate-me on [language]\``,
            response_type: 'ephemeral'
        });
    } else if (args[0] === 'off') {
        const currentSettings = getUserSettings(user_id);

        setUserSettings(user_id, {
            ...currentSettings,
            enabled: false
        });

        console.log(`❌ Personal auto-translate disabled for user ${user_id}`);

        await respond({
            text: '❌ Personal auto-translate disabled. You will no longer receive individual translations.',
            response_type: 'ephemeral'
        });
    } else if (args[0] === 'status') {
        const settings = getUserSettings(user_id);

        if (settings.enabled) {
            await respond({
                text: `📊 *Your Personal Auto-Translate Status:*\n• Status: ✅ *Enabled*\n• Target Language: *${settings.targetLanguage}*\n• You receive private translations for messages not in your target language.\n\nCommands:\n• \`/autotranslate-me off\` - Disable\n• \`/autotranslate-me on [language]\` - Change language`,
                response_type: 'ephemeral'
            });
        } else {
            await respond({
                text: `📊 *Your Personal Auto-Translate Status:*\n• Status: ❌ *Disabled*\n\nTo enable: \`/autotranslate-me on [language]\`\nExample: \`/autotranslate-me on spanish\``,
                response_type: 'ephemeral'
            });
        }
    } else {
        await respond({
            text: `*Personal Auto-Translate Commands:*\n\n• \`/autotranslate-me on [language]\` - Enable personal auto-translate\n  Example: \`/autotranslate-me on spanish\`\n  Default: \`/autotranslate-me on\` (English)\n\n• \`/autotranslate-me off\` - Disable personal auto-translate\n\n• \`/autotranslate-me status\` - Check your current settings\n\n*Available languages:*\n${Object.entries(languageFlags).map(([code, flag]) => {
                const langNames = {
                    'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
                    'it': 'Italian', 'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese',
                    'ko': 'Korean', 'zh': 'Chinese', 'ar': 'Arabic', 'tr': 'Turkish'
                };
                return `${flag} ${langNames[code]} (\`${code}\`)`;
            }).join(', ')}\n\n_Note: Personal translations are private - only you can see them!_`,
            response_type: 'ephemeral'
        });
    }
});

app.error((error) => {
    console.error('Slack app error:', error);
});

(async () => {
    try {
        await app.start();
        console.log('⚡️ Slack Translation Bot is running!');
        console.log('Listening for messages and slash commands...');
        console.log('📋 Loaded settings:');
        console.log(`  - Channel settings: ${channelSettings.size} channels configured`);
        console.log(`  - User settings: ${userSettings.size} users configured`);

        // Log existing channel configurations
        for (const [channelId, settings] of channelSettings) {
            console.log(`  - Channel ${channelId}: ${settings.enabled ? 'ON' : 'OFF'}, languages: ${(settings.activeLanguages || ['en', 'tr']).join(', ')}`);
        }

        // Log user configurations
        for (const [userId, settings] of userSettings) {
            console.log(`  - User ${userId}: ${settings.enabled ? 'ON' : 'OFF'}, target: ${settings.targetLanguage}`);
        }
    } catch (error) {
        console.error('Failed to start app:', error);
        process.exit(1);
    }
})();

// Add event logging
app.event('message', async ({ event, client }) => {
    console.log('🎯 Raw message event received:', JSON.stringify(event, null, 2));
});