import { Injectable, Logger } from '@nestjs/common';
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

  constructor(
    private readonly cacheService: CacheService,
    private readonly languageService: LanguageService,
  ) {}

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
    const analysis = this.buildAnalysis(languageResult, false, Date.now() - startTime);

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
  ): AnalysisDto {
    return {
      language: languageResult.language,
      lang_certainity: languageResult.confidence,
      cached,
      processing_time_ms: processingTime,
      risk_level: 0,
      triggers: [],
      enhanced: this.buildEnhancedAnalysis(),
    };
  }

  /**
   * Build enhanced analysis with placeholder values
   */
  private buildEnhancedAnalysis(): EnhancedAnalysisDto {
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
      urls: [],
      phones: [],
    };
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
