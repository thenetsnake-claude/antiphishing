import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import LinkifyIt = require('linkify-it');
// eslint-disable-next-line @typescript-eslint/no-require-imports
import tlds = require('tlds');
import { CacheService } from '../cache/cache.service';
import { LanguageService } from '../language/language.service';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import { AnalyzeResponseDto, AnalysisDto, EnhancedAnalysisDto } from './dto/analyze-response.dto';

/**
 * Service for content analysis
 * Orchestrates language detection and caching
 */
@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);
  private readonly CACHE_TTL = 60; // 60 seconds
  private readonly linkify: LinkifyIt;

  constructor(
    private readonly cacheService: CacheService,
    private readonly languageService: LanguageService,
  ) {
    // Initialize linkify-it with all TLDs and fuzzy matching for domains without protocol
    this.linkify = new LinkifyIt();
    this.linkify.tlds(tlds); // Add all known TLDs (1500+)
    this.linkify.set({ fuzzyLink: true, fuzzyEmail: false });
  }

  /**
   * Analyze content and return analysis results
   * Checks cache first, performs analysis if not cached
   */
  async analyze(request: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
    const startTime = Date.now();

    this.logger.debug('Analyzing content', {
      parentID: request.parentID,
      customerID: request.customerID,
      senderID: request.senderID,
      messageID: request.messageID,
      contentLength: request.content.length,
    });

    // Check cache
    const cachedResult = await this.cacheService.get<AnalysisDto>(request.content);
    if (cachedResult) {
      const processingTime = Date.now() - startTime;
      this.logger.log('Returning cached analysis result', {
        messageID: request.messageID,
        language: cachedResult.language,
        processingTime,
      });

      return this.buildResponse(cachedResult, true, processingTime);
    }

    // Perform language detection
    const languageResult = this.languageService.detect(request.content);

    // Build analysis result
    const analysis = this.buildAnalysis(
      languageResult,
      false,
      Date.now() - startTime,
      request.content,
    );

    // Cache the analysis result
    await this.cacheService.set(request.content, analysis, this.CACHE_TTL);

    const processingTime = Date.now() - startTime;
    this.logger.log('Analysis completed', {
      messageID: request.messageID,
      language: analysis.language,
      confidence: analysis.lang_certainity,
      cached: false,
      processingTime,
    });

    return this.buildResponse(analysis, false, processingTime);
  }

  /**
   * Build analysis object from language detection result
   */
  private buildAnalysis(
    languageResult: { language: string; confidence: number },
    cached: boolean,
    processingTime: number,
    content: string,
  ): AnalysisDto {
    return {
      language: languageResult.language,
      lang_certainity: languageResult.confidence,
      cached,
      processing_time_ms: processingTime,
      risk_level: 0,
      triggers: [],
      enhanced: this.buildEnhancedAnalysis(content),
    };
  }

  /**
   * Build enhanced analysis with URL detection
   */
  private buildEnhancedAnalysis(content: string): EnhancedAnalysisDto {
    return {
      keyword_density: 0,
      message_length_risk: 0,
      mixed_content_risk: 0,
      caps_ratio_risk: 0,
      total_context_risk: 0,
      burst_pattern_risk: 0,
      off_hours_risk: 0,
      weekend_spike: 0,
      total_temporal_risk: 0,
      suspicious_tld: '',
      phishing_keywords: [],
      urls: this.extractUrls(content),
      phones: [],
    };
  }

  /**
   * Extract URLs from content using linkify-it library
   * Supports all TLDs and properly handles URLs with/without protocols
   */
  private extractUrls(content: string): string[] {
    // Use linkify-it to find all URLs (supports all TLDs automatically)
    const matches = this.linkify.match(content);

    if (!matches) {
      return [];
    }

    // Extract and normalize URLs
    const urls: string[] = matches.map((match: LinkifyIt.Match) => {
      let url = match.url;

      // Ensure protocol is present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `http://${url}`;
      }

      return url;
    });

    // Remove duplicates and return
    return [...new Set(urls)];
  }

  /**
   * Build final response
   */
  private buildResponse(
    analysis: AnalysisDto,
    cached: boolean,
    processingTime: number,
  ): AnalyzeResponseDto {
    // Update processing time and cached flag
    analysis.cached = cached;
    analysis.processing_time_ms = processingTime;

    return {
      status: 'safe',
      certainity: 0,
      message: 'no analysis',
      customer_whitelisted: false,
      analysis,
    };
  }
}
