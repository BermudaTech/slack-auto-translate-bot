const { Translate } = require('@google-cloud/translate').v2;

class TranslateService {
    constructor(apiKey) {
        this.translate = new Translate({
            key: apiKey,
            projectId: 'slack-translate-app'
        });
    }

    async translateText(text, targetLanguage, sourceLanguage = null) {
        try {
            const [translation] = await this.translate.translate(text, {
                from: sourceLanguage,
                to: targetLanguage
            });

            const [detection] = await this.translate.detect(text);
            const detectedLanguage = detection.language;

            return {
                translatedText: translation,
                sourceLanguage: detectedLanguage,
                targetLanguage: targetLanguage
            };
        } catch (error) {
            console.error('Translation error:', error);
            throw new Error('Translation failed');
        }
    }

    getLanguageCode(language) {
        const languageMap = {
            'spanish': 'es',
            'french': 'fr', 
            'german': 'de',
            'italian': 'it',
            'portuguese': 'pt',
            'russian': 'ru',
            'japanese': 'ja',
            'korean': 'ko',
            'chinese': 'zh',
            'arabic': 'ar',
            'english': 'en',
            'turkish': 'tr'
        };
        
        return languageMap[language.toLowerCase()] || language;
    }
}

module.exports = TranslateService;