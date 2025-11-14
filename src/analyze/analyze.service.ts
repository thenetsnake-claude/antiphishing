import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import LinkifyIt = require('linkify-it');
// eslint-disable-next-line @typescript-eslint/no-require-imports
import tlds = require('tlds');
import { findPhoneNumbersInText, PhoneNumber } from 'libphonenumber-js';
import * as ipaddr from 'ipaddr.js';
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

    this.logger.debug(
      `Analyzing content - messageID: ${request.messageID}, contentLength: ${request.content.length}`,
    );

    // Check cache
    const cachedResult = await this.cacheService.get<AnalysisDto>(request.content);
    if (cachedResult) {
      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Returning cached analysis result - messageID: ${request.messageID}, language: ${cachedResult.language}, processingTime: ${processingTime}ms`,
      );

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
    this.logger.log(
      `Analysis completed - messageID: ${request.messageID}, language: ${analysis.language}, confidence: ${analysis.lang_certainity}, cached: false, processingTime: ${processingTime}ms`,
    );

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
   * Build enhanced analysis with URL detection, phone detection, and public IP detection
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
      phones: this.extractPhones(content),
      public_ips: this.extractPublicIPs(content),
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
   * Extract phone numbers from content using libphonenumber-js
   * Handles various formats: international, local, with separators (. / ( ) -)
   * Uses Belgium (BE) as default country for local number detection
   */
  private extractPhones(content: string): string[] {
    try {
      // Find all phone numbers in text with Belgium as default country
      // This allows detection of local Belgian numbers like "0800 33 800"
      const phoneNumbers = findPhoneNumbersInText(content, 'BE');

      if (!phoneNumbers || phoneNumbers.length === 0) {
        return [];
      }

      // Extract and format phone numbers in international format
      const phones: string[] = phoneNumbers
        .map((item) => {
          try {
            const phoneNumber: PhoneNumber = item.number;
            // Return in international format (E.164) as string
            return phoneNumber.number.toString();
          } catch {
            return null;
          }
        })
        .filter((phone): phone is string => phone !== null);

      // Remove duplicates and return
      return [...new Set(phones)];
    } catch {
      // If phone number extraction fails, return empty array
      return [];
    }
  }

  /**
   * Extract public IP addresses from content
   * Detects both IPv4 and IPv6 addresses and filters out private/local IPs
   */
  private extractPublicIPs(content: string): string[] {
    try {
      const ips: string[] = [];

      // IPv4 regex pattern
      const ipv4Pattern =
        /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

      // IPv6 regex pattern (simplified - matches most common formats)
      const ipv6Pattern =
        /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b|\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b|\b::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}\b|\b[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}\b/g;

      // Find all IPv4 addresses
      const ipv4Matches = content.match(ipv4Pattern) || [];
      for (const ip of ipv4Matches) {
        try {
          const addr = ipaddr.parse(ip);
          // Check if it's IPv4 and not private/reserved
          if (addr.kind() === 'ipv4' && !this.isPrivateIP(addr)) {
            ips.push(ip);
          }
        } catch {
          // Invalid IP, skip
        }
      }

      // Find all IPv6 addresses
      const ipv6Matches = content.match(ipv6Pattern) || [];
      for (const ip of ipv6Matches) {
        try {
          const addr = ipaddr.parse(ip);
          // Check if it's IPv6 and not private/reserved
          if (addr.kind() === 'ipv6' && !this.isPrivateIP(addr)) {
            ips.push(addr.toString());
          }
        } catch {
          // Invalid IP, skip
        }
      }

      // Remove duplicates and return
      return [...new Set(ips)];
    } catch {
      // If IP extraction fails, return empty array
      return [];
    }
  }

  /**
   * Check if an IP address is private/local
   */
  private isPrivateIP(addr: ipaddr.IPv4 | ipaddr.IPv6): boolean {
    try {
      // For IPv4, check private ranges
      if (addr.kind() === 'ipv4') {
        const range = (addr as ipaddr.IPv4).range();
        return (
          range === 'private' ||
          range === 'loopback' ||
          range === 'linkLocal' ||
          range === 'broadcast' ||
          range === 'reserved' ||
          range === 'carrierGradeNat'
        );
      }

      // For IPv6, check private ranges
      if (addr.kind() === 'ipv6') {
        const range = (addr as ipaddr.IPv6).range();
        return (
          range === 'loopback' ||
          range === 'linkLocal' ||
          range === 'uniqueLocal' ||
          range === 'multicast' ||
          range === 'reserved'
        );
      }

      return false;
    } catch {
      // If range check fails, consider it private to be safe
      return true;
    }
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
