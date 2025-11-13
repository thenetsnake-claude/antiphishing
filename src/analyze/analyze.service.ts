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
    const analysis = this.buildAnalysis(languageResult, false, Date.now() - startTime, request.content);

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
   * Extract URLs from content using regex patterns
   * Detects http://, https://, www., and bare domain URLs
   */
  private extractUrls(content: string): string[] {
    const urls: string[] = [];

    // Pattern 1: URLs with protocol (http://, https://)
    const protocolPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const protocolMatches = content.match(protocolPattern);
    if (protocolMatches) {
      urls.push(
        ...protocolMatches.map(url => url.replace(/[.,;!?:'")\]]+$/, '')),
      );
    }

    // Pattern 2: URLs starting with www.
    const wwwPattern = /www\.[^\s<>"{}|\\^`\[\]]+/gi;
    const wwwMatches = content.match(wwwPattern);
    if (wwwMatches) {
      urls.push(
        ...wwwMatches.map(url => `http://${url.replace(/[.,;!?:'")\]]+$/, '')}`),
      );
    }

    // Pattern 3: Bare domains (e.g., example.com, test.org)
    // Match domain.tld with common TLDs, but not in email addresses
    const bareDomainPattern = /(?<![/@])(?:^|\s)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|mil|co|io|dev|app|tech|info|biz|name|pro|museum|aero|asia|cat|coop|jobs|mobi|tel|travel|xxx|uk|us|ca|au|de|fr|it|nl|es|ru|jp|cn|in|br|mx|za|se|no|fi|dk|be|ch|at|nz|sg|hk|kr|tw|my|ph|th|vn|id|ar|cl|co\.uk|co\.za|com\.au|com\.br)(?:\s|$|[^\w.-])/gi;
    const bareDomainMatches = content.match(bareDomainPattern);
    if (bareDomainMatches) {
      const cleanedDomains = bareDomainMatches
        .map(match => match.trim())
        // Remove trailing punctuation (commas, periods, etc.)
        .map(match => match.replace(/[.,;!?:'")\]]+$/, ''))
        .filter(domain => {
          // Exclude if it's part of an email address
          const emailCheck = new RegExp(`\\S+@${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
          return !emailCheck.test(content);
        })
        .map(domain => `http://${domain}`);
      urls.push(...cleanedDomains);
    }

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
