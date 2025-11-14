import { Injectable, Logger } from '@nestjs/common';
import { francAll } from 'franc';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

/**
 * Service for detecting language from text content
 * Uses franc library for fast, offline language detection
 */
@Injectable()
export class LanguageService {
  private readonly logger = new Logger(LanguageService.name);

  // Common English words for fallback detection when confidence is low
  private readonly COMMON_ENGLISH_WORDS = new Set([
    'the',
    'be',
    'to',
    'of',
    'and',
    'a',
    'in',
    'that',
    'have',
    'i',
    'it',
    'for',
    'not',
    'on',
    'with',
    'he',
    'as',
    'you',
    'do',
    'at',
    'this',
    'but',
    'his',
    'by',
    'from',
    'they',
    'we',
    'say',
    'her',
    'she',
    'or',
    'an',
    'will',
    'my',
    'one',
    'all',
    'would',
    'there',
    'their',
    'what',
    'so',
    'up',
    'out',
    'if',
    'about',
    'who',
    'get',
    'which',
    'go',
    'me',
    'when',
    'make',
    'can',
    'like',
    'time',
    'no',
    'just',
    'him',
    'know',
    'take',
    'people',
    'into',
    'year',
    'your',
    'good',
    'some',
    'could',
    'them',
    'see',
    'other',
    'than',
    'then',
    'now',
    'look',
    'only',
    'come',
    'its',
    'over',
    'think',
    'also',
    'back',
    'after',
    'use',
    'two',
    'how',
    'our',
    'work',
    'first',
    'well',
    'way',
    'even',
    'new',
    'want',
    'because',
    'any',
    'these',
    'give',
    'day',
    'most',
    'us',
    'is',
    'was',
    'are',
    'been',
    'has',
    'had',
    'were',
    'said',
    'did',
    'having',
    'test',
    'message',
    'structure',
    'validation',
    'hello',
    'world',
    'please',
    'thank',
  ]);

  /**
   * Detect language from content
   * @param content - Text content to analyze
   * @returns Language code and confidence percentage
   */
  detect(content: string): LanguageDetectionResult {
    try {
      if (!content || content.trim().length === 0) {
        this.logger.warn('Empty content provided for language detection');
        return {
          language: 'unknown',
          confidence: 0,
        };
      }

      // Use francAll to get confidence scores
      const results = francAll(content, { minLength: 1 });

      if (!results || results.length === 0 || results[0][0] === 'und') {
        this.logger.debug('Language detection returned undefined');
        return {
          language: 'unknown',
          confidence: 0,
        };
      }

      const [detectedLang, score] = results[0];

      // Convert franc's score (distance metric) to confidence percentage
      // franc returns lower scores for better matches (distance from language model)
      // Typical ranges: 0-0.5 = excellent, 0.5-1.0 = good, > 1.0 = poor
      // We convert to 0-100 percentage (higher is better)
      const rawConfidence = (1 - score) * 100;
      let confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));
      let finalLang = detectedLang;

      // If confidence is very low, check for English words
      // This helps with short texts where franc may misidentify the language
      if (confidence < 15) {
        const englishWordRatio = this.calculateEnglishWordRatio(content);

        // If we have significant English words (>30%), check if eng is in top results
        if (englishWordRatio > 0.3) {
          const engResult = results.find((r) => r[0] === 'eng');
          if (engResult) {
            const engScore = engResult[1];
            const engConfidence = Math.max(0, Math.min(100, Math.round((1 - engScore) * 100)));

            // If English confidence is within 10% of detected language, prefer English
            if (Math.abs(confidence - engConfidence) <= 10) {
              finalLang = 'eng';
              confidence = Math.max(confidence, engConfidence);
              this.logger.debug(
                `Overriding ${detectedLang} with eng due to English word ratio: ${(englishWordRatio * 100).toFixed(0)}%`,
              );
            }
          }
        }
      }

      this.logger.debug(`Detected language: ${finalLang} with confidence: ${confidence}% (score: ${score})`);

      return {
        language: finalLang,
        confidence,
      };
    } catch (error) {
      this.logger.error(`Language detection failed: ${error.message}`, error.stack);
      return {
        language: 'unknown',
        confidence: 0,
      };
    }
  }

  /**
   * Calculate the ratio of common English words in the content
   * Used as a fallback when franc has low confidence
   */
  private calculateEnglishWordRatio(content: string): number {
    try {
      // Extract words (3+ characters) and convert to lowercase
      const words = content
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      if (words.length === 0) {
        return 0;
      }

      const englishWordCount = words.filter((w) => this.COMMON_ENGLISH_WORDS.has(w)).length;

      return englishWordCount / words.length;
    } catch {
      return 0;
    }
  }
}
