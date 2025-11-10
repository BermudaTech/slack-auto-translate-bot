const { Translate } = require('@google-cloud/translate').v2;

class TranslateService {
    constructor(apiKey) {
        this.translate = new Translate({
            key: apiKey
        });
    }

    async translateText(text, targetLanguage, sourceLanguage = null) {
        try {
            console.log('🔤 Translation request:', { text: text?.substring(0, 50), targetLanguage, sourceLanguage });

            // Build options object - only include 'from' if sourceLanguage is specified
            const options = { to: targetLanguage };
            if (sourceLanguage) {
                options.from = sourceLanguage;
            }

            const [translation] = await this.translate.translate(text, options);

            const [detection] = await this.translate.detect(text);
            const detectedLanguage = detection.language;

            return {
                translatedText: translation,
                sourceLanguage: detectedLanguage,
                targetLanguage: targetLanguage
            };
        } catch (error) {
            console.error('Translation error details:', {
                message: error.message,
                code: error.code,
                status: error.status,
                statusText: error.statusText,
                errors: error.errors,
                response: error.response?.data
            });
            throw new Error(`Translation failed: ${error.message || 'Unknown error'}`);
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