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

// Load channel settings from config file
function loadChannelSettings() {
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return new Map(Object.entries(config.channelSettings));
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
    return new Map();
}

// Save channel settings to config file
function saveChannelSettings(channelSettings) {
    try {
        const config = {
            channelSettings: Object.fromEntries(channelSettings)
        };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('💾 Channel settings saved');
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

const channelSettings = loadChannelSettings();

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
    
    if (message.subtype || message.bot_id) {
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
    
    if (!settings || !settings.enabled) {
        console.log('❌ Translation not enabled for this channel');
        return;
    }
    
    try {
        // Detect source language first
        const [detection] = await translateService.translate.detect(message.text);
        const detectedLanguage = detection.language;
        
        console.log('🔍 Detected language:', detectedLanguage);
        
        // Get active languages for this channel (default to en/tr if none set)
        const activeLanguages = settings.activeLanguages || ['en', 'tr'];
        
        // Find the target language (the other language that's not the detected one)
        const targetLang = activeLanguages.find(lang => lang !== detectedLanguage);
        
        if (targetLang) {
            const result = await translateService.translateText(
                message.text, 
                targetLang
            );
            
            // Check if translation is the same as original text
            if (normalizeText(result.translatedText) === normalizeText(message.text)) {
                console.log('⏭️ Skipping identical translation');
                return;
            }
            
            // Get user info to display username and avatar
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
        
    } catch (error) {
        console.error('Translation failed:', error);
        
        await client.chat.postMessage({
            channel: channelId,
            thread_ts: message.ts,
            text: '⚠️ Translation failed. Please try again later.'
        });
    }
});

app.command('/autotranslate', async ({ command, ack, respond, client }) => {
    await ack();
    
    console.log('🔧 Slash command received:', command);
    
    const { channel_id, text } = command;
    const args = text.trim().split(' ');
    
    if (args[0] === 'on') {
        try {
            // Check if bot is in the channel by trying to get channel info
            await client.conversations.info({
                channel: channel_id
            });
        } catch (error) {
            console.log('❌ Bot not in channel:', channel_id, error.data?.error);
            await respond({
                text: '⚠️ Bot needs to be added to this channel first. Please invite @TranslateBot to the channel before enabling auto-translation.',
                response_type: 'ephemeral'
            });
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
        
        saveChannelSettings(channelSettings);
        
        console.log('✅ Translation enabled for channel:', channel_id, 'Languages:', activeLanguages);
        
        await respond({
            text: `✅ Auto-translation enabled for this channel. Active languages: ${activeLanguages.join(', ')}`,
            response_type: 'ephemeral'
        });
    } else if (args[0] === 'off') {
        channelSettings.delete(channel_id);
        
        saveChannelSettings(channelSettings);
        
        console.log('❌ Translation disabled for channel:', channel_id);
        
        await respond({
            text: '❌ Auto-translation disabled for this channel',
            response_type: 'ephemeral'
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

app.error((error) => {
    console.error('Slack app error:', error);
});

(async () => {
    try {
        await app.start();
        console.log('⚡️ Slack Translation Bot is running!');
        console.log('Listening for messages and slash commands...');
        console.log('📋 Loaded channel settings:', channelSettings.size, 'channels configured');
        
        // Log existing channel configurations
        for (const [channelId, settings] of channelSettings) {
            console.log(`  - Channel ${channelId}: ${settings.enabled ? 'ON' : 'OFF'}, languages: ${(settings.activeLanguages || ['en', 'tr']).join(', ')}`);
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