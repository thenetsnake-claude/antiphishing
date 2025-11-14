import { Injectable, Logger } from '@nestjs/common';
import { francAll } from 'franc';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

/**
 * Service for detecting language from text content
 * Uses franc library for fast, offline language detection
 * Supports only: English, French, Dutch, German, Polish, Spanish, Italian, Portuguese
 */
@Injectable()
export class LanguageService {
  private readonly logger = new Logger(LanguageService.name);

  // Supported languages (whitelisted)
  private readonly SUPPORTED_LANGUAGES = new Set(['eng', 'fra', 'nld', 'deu', 'pol', 'spa', 'ita', 'por']);

  // Common words dictionaries for all supported languages
  private readonly COMMON_WORDS = new Map<string, Set<string>>([
    [
      'eng',
      new Set([
        'the',
        'be',
        'to',
        'of',
        'and',
        'a',
        'in',
        'that',
        'have',
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
      ]),
    ],
    [
      'fra',
      new Set([
        'le',
        'de',
        'un',
        'être',
        'et',
        'à',
        'il',
        'avoir',
        'ne',
        'je',
        'son',
        'que',
        'se',
        'qui',
        'ce',
        'dans',
        'en',
        'du',
        'elle',
        'au',
        'pour',
        'pas',
        'que',
        'vous',
        'par',
        'sur',
        'faire',
        'plus',
        'dire',
        'me',
        'on',
        'mon',
        'lui',
        'nous',
        'comme',
        'mais',
        'pouvoir',
        'avec',
        'tout',
        'y',
        'aller',
        'voir',
        'en',
        'bien',
        'où',
        'sans',
        'tu',
        'ou',
        'leur',
        'homme',
        'si',
        'deux',
        'même',
        'autre',
        'dans',
        'toujours',
        'très',
        'quoi',
        'moins',
        'dont',
        'chose',
        'peu',
        'tous',
        'vie',
        'ses',
        'encore',
        'vouloir',
        'chez',
        'aussi',
        'avant',
        'grand',
        'depuis',
        'sous',
        'après',
        'peuvent',
        'contre',
        'bonjour',
        'merci',
        'message',
        'test',
        'info',
        'pour',
        'contact',
        'agence',
      ]),
    ],
    [
      'nld',
      new Set([
        'de',
        'het',
        'een',
        'van',
        'en',
        'in',
        'zijn',
        'dat',
        'te',
        'op',
        'voor',
        'met',
        'die',
        'aan',
        'niet',
        'als',
        'ook',
        'maar',
        'uit',
        'hebben',
        'of',
        'was',
        'door',
        'er',
        'kan',
        'bij',
        'worden',
        'ze',
        'worden',
        'om',
        'naar',
        'nog',
        'dan',
        'deze',
        'hij',
        'worden',
        'wel',
        'meer',
        'hun',
        'zou',
        'zijn',
        'over',
        'al',
        'worden',
        'dit',
        'geen',
        'zich',
        'tot',
        'alleen',
        'onder',
        'jaar',
        'twee',
        'tussen',
        'nu',
        'daar',
        'kunnen',
        'mensen',
        'alles',
        'veel',
        'zo',
        'andere',
        'wij',
        'nieuw',
        'waar',
        'hallo',
        'dank',
        'bericht',
        'test',
        'info',
        'contact',
      ]),
    ],
    [
      'deu',
      new Set([
        'der',
        'die',
        'und',
        'in',
        'den',
        'von',
        'zu',
        'das',
        'mit',
        'sich',
        'des',
        'auf',
        'für',
        'ist',
        'im',
        'dem',
        'nicht',
        'ein',
        'eine',
        'als',
        'auch',
        'es',
        'an',
        'werden',
        'aus',
        'er',
        'hat',
        'dass',
        'sie',
        'nach',
        'wird',
        'bei',
        'einer',
        'um',
        'am',
        'sind',
        'noch',
        'wie',
        'einem',
        'über',
        'einen',
        'so',
        'zum',
        'war',
        'haben',
        'nur',
        'oder',
        'aber',
        'vor',
        'zur',
        'bis',
        'mehr',
        'durch',
        'man',
        'sein',
        'wurde',
        'sei',
        'kann',
        'gegen',
        'vom',
        'können',
        'schon',
        'wenn',
        'hallo',
        'danke',
        'nachricht',
        'test',
        'info',
        'kontakt',
      ]),
    ],
    [
      'pol',
      new Set([
        'w',
        'i',
        'na',
        'z',
        'do',
        'nie',
        'się',
        'że',
        'to',
        'o',
        'jest',
        'jest',
        'po',
        'dla',
        'co',
        'jak',
        'się',
        'za',
        'od',
        'jego',
        'tylko',
        'być',
        'przy',
        'ma',
        'przez',
        'ale',
        'tak',
        'ze',
        'czy',
        'może',
        'tym',
        'aby',
        'już',
        'bardzo',
        'pan',
        'tej',
        'został',
        'będzie',
        'była',
        'może',
        'można',
        'nad',
        'pod',
        'przed',
        'też',
        'gdy',
        'mnie',
        'więc',
        'bez',
        'lub',
        'był',
        'kiedy',
        'oraz',
        'wszystko',
        'świat',
        'gdzie',
        'dwa',
        'wszystkie',
        'cześć',
        'dziękuję',
        'wiadomość',
        'test',
        'info',
        'kontakt',
      ]),
    ],
    [
      'spa',
      new Set([
        'de',
        'la',
        'que',
        'el',
        'en',
        'y',
        'a',
        'los',
        'se',
        'del',
        'las',
        'un',
        'por',
        'con',
        'no',
        'una',
        'su',
        'para',
        'es',
        'al',
        'lo',
        'como',
        'más',
        'o',
        'pero',
        'sus',
        'le',
        'ha',
        'me',
        'si',
        'sin',
        'sobre',
        'este',
        'ya',
        'entre',
        'cuando',
        'todo',
        'esta',
        'ser',
        'son',
        'dos',
        'también',
        'fue',
        'había',
        'era',
        'muy',
        'años',
        'hasta',
        'desde',
        'está',
        'mi',
        'porque',
        'qué',
        'sólo',
        'han',
        'yo',
        'hay',
        'vez',
        'puede',
        'todos',
        'así',
        'nos',
        'ni',
        'parte',
        'tiene',
        'él',
        'uno',
        'donde',
        'bien',
        'tiempo',
        'mismo',
        'ese',
        'hola',
        'gracias',
        'mensaje',
        'test',
        'info',
        'contacto',
      ]),
    ],
    [
      'ita',
      new Set([
        'di',
        'il',
        'e',
        'la',
        'a',
        'che',
        'per',
        'un',
        'in',
        'è',
        'non',
        'si',
        'da',
        'con',
        'i',
        'una',
        'le',
        'questo',
        'del',
        'sono',
        'essere',
        'al',
        'più',
        'su',
        'come',
        'ma',
        'anche',
        'alla',
        'stato',
        'delle',
        'nel',
        'gli',
        'dalla',
        'cui',
        'ai',
        'quale',
        'hanno',
        'ha',
        'questa',
        'dei',
        'tutti',
        'stesso',
        'nella',
        'era',
        'molto',
        'loro',
        'ancora',
        'altri',
        'così',
        'quella',
        'suo',
        'fare',
        'solo',
        'anni',
        'due',
        'tutto',
        'dello',
        'nei',
        'quello',
        'sempre',
        'parte',
        'dove',
        'tempo',
        'alle',
        'ogni',
        'quando',
        'già',
        'ogni',
        'fatto',
        'può',
        'deve',
        'ciao',
        'grazie',
        'messaggio',
        'test',
        'info',
        'contatto',
      ]),
    ],
    [
      'por',
      new Set([
        'de',
        'a',
        'o',
        'que',
        'e',
        'do',
        'da',
        'em',
        'um',
        'para',
        'é',
        'com',
        'não',
        'uma',
        'os',
        'no',
        'se',
        'na',
        'por',
        'mais',
        'as',
        'dos',
        'como',
        'mas',
        'foi',
        'ao',
        'ele',
        'das',
        'tem',
        'à',
        'seu',
        'sua',
        'ou',
        'ser',
        'quando',
        'muito',
        'há',
        'nos',
        'já',
        'está',
        'eu',
        'também',
        'só',
        'pelo',
        'pela',
        'até',
        'isso',
        'ela',
        'entre',
        'era',
        'depois',
        'sem',
        'mesmo',
        'aos',
        'ter',
        'seus',
        'quem',
        'nas',
        'me',
        'esse',
        'eles',
        'estão',
        'você',
        'tinha',
        'foram',
        'essa',
        'num',
        'nem',
        'suas',
        'meu',
        'às',
        'minha',
        'têm',
        'numa',
        'pelos',
        'elas',
        'havia',
        'olá',
        'obrigado',
        'mensagem',
        'teste',
        'info',
        'contato',
      ]),
    ],
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
      const allResults = francAll(content, { minLength: 1 });

      if (!allResults || allResults.length === 0 || allResults[0][0] === 'und') {
        this.logger.debug('Language detection returned undefined');
        return {
          language: 'unknown',
          confidence: 0,
        };
      }

      // Filter to only supported languages
      const results = allResults.filter(([lang]) => this.SUPPORTED_LANGUAGES.has(lang));

      if (results.length === 0) {
        this.logger.debug('No supported languages detected');
        return {
          language: 'unknown',
          confidence: 0,
        };
      }

      const [detectedLang, score] = results[0];

      // Convert franc's score to confidence percentage
      // franc returns higher scores for better matches (confidence value 0-1)
      // Typical ranges: 1.0 = perfect, 0.8-1.0 = excellent, 0.6-0.8 = good, < 0.6 = poor
      // We convert to 0-100 percentage (higher is better)
      const rawConfidence = score * 100;
      let confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));
      let finalLang = detectedLang;

      // If confidence is very low, use common words analysis as fallback
      // This helps with short texts where franc may misidentify the language
      if (confidence < 15) {
        const bestMatch = this.findBestLanguageByWords(content, results);
        if (bestMatch) {
          finalLang = bestMatch.language;
          confidence = bestMatch.confidence;
          this.logger.debug(
            `Overriding ${detectedLang} with ${bestMatch.language} due to word analysis (ratio: ${(bestMatch.wordRatio * 100).toFixed(0)}%)`,
          );
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
   * Find the best language match by analyzing common words
   * Checks all supported languages and returns the one with highest word ratio
   * Used as a fallback when franc has low confidence
   */
  private findBestLanguageByWords(
    content: string,
    francResults: Array<[string, number]>,
  ): { language: string; confidence: number; wordRatio: number } | null {
    try {
      let bestMatch: { language: string; confidence: number; wordRatio: number } | null = null;

      // Check each language in franc's top results
      for (const [lang, score] of francResults) {
        if (!this.SUPPORTED_LANGUAGES.has(lang)) {
          continue;
        }

        const wordRatio = this.calculateLanguageWordRatio(content, lang);

        // If we have significant words for this language (>30%)
        if (wordRatio > 0.3) {
          const langConfidence = Math.max(0, Math.min(100, Math.round(score * 100)));

          // Keep track of the best match
          if (!bestMatch || wordRatio > bestMatch.wordRatio) {
            bestMatch = {
              language: lang,
              confidence: langConfidence,
              wordRatio,
            };
          }
        }
      }

      return bestMatch;
    } catch {
      return null;
    }
  }

  /**
   * Calculate the ratio of common words for a specific language
   * Returns the percentage of words that match the language's common words dictionary
   */
  private calculateLanguageWordRatio(content: string, language: string): number {
    try {
      const dictionary = this.COMMON_WORDS.get(language);
      if (!dictionary) {
        return 0;
      }

      // Extract words (3+ characters for most languages, 2+ for short words like "de", "le", "la")
      // Support Unicode letters for languages with special characters
      const words = content
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics for matching
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1);

      if (words.length === 0) {
        return 0;
      }

      const matchingWords = words.filter((w) => dictionary.has(w)).length;

      return matchingWords / words.length;
    } catch {
      return 0;
    }
  }
}
