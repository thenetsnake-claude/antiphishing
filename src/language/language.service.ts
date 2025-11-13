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

      // Convert franc's score (0-1) to percentage
      // franc returns lower scores for higher confidence (distance metric)
      // We invert and normalize it
      const confidence = Math.round((1 - score) * 100);

      this.logger.debug(`Detected language: ${detectedLang} with confidence: ${confidence}%`);

      return {
        language: detectedLang,
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
}
