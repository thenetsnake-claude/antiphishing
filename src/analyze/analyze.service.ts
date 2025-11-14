import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import LinkifyIt = require('linkify-it');
// eslint-disable-next-line @typescript-eslint/no-require-imports
import tlds = require('tlds');
import { findPhoneNumbersInText, PhoneNumber } from 'libphonenumber-js';
import * as ipaddr from 'ipaddr.js';
import * as linkShorteners from 'link-shorteners';
import { CacheService } from '../cache/cache.service';
import { LanguageService } from '../language/language.service';
import { RedirectService } from './redirect.service';
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
  private readonly shortenerDomains: string[];

  constructor(
    private readonly cacheService: CacheService,
    private readonly languageService: LanguageService,
    private readonly redirectService: RedirectService,
  ) {
    // Initialize linkify-it with all TLDs and fuzzy matching for domains without protocol
    this.linkify = new LinkifyIt();
    this.linkify.tlds(tlds); // Add all known TLDs (1500+)
    this.linkify.set({ fuzzyLink: true, fuzzyEmail: false });

    // Load list of known shortener domains
    this.shortenerDomains = linkShorteners.listLinkShorterners();
    this.logger.log(`Loaded ${this.shortenerDomains.length} known URL shortener domains`);
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
    const analysis = await this.buildAnalysis(
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
  private async buildAnalysis(
    languageResult: { language: string; confidence: number },
    cached: boolean,
    processingTime: number,
    content: string,
  ): Promise<AnalysisDto> {
    return {
      language: languageResult.language,
      lang_certainity: languageResult.confidence,
      cached,
      processing_time_ms: processingTime,
      risk_level: 0,
      triggers: [],
      enhanced: await this.buildEnhancedAnalysis(content),
    };
  }

  /**
   * Build enhanced analysis with URL detection, phone detection, and public IP detection
   * Detects URL shorteners and follows redirects to get final destinations
   */
  private async buildEnhancedAnalysis(content: string): Promise<EnhancedAnalysisDto> {
    const urlResult = await this.extractUrls(content);

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
      urls: urlResult.urls,
      phones: this.extractPhones(content),
      public_ips: this.extractPublicIPs(content),
      shortener_used: urlResult.shorteners,
    };
  }

  /**
   * Extract URLs from content using linkify-it library
   * Detects URL shorteners and follows redirects to get final URLs
   * Supports all TLDs and properly handles URLs with/without protocols
   */
  private async extractUrls(
    content: string,
  ): Promise<{ urls: string[]; shorteners: string[] }> {
    // Use linkify-it to find all URLs (supports all TLDs automatically)
    const matches = this.linkify.match(content);

    if (!matches) {
      return { urls: [], shorteners: [] };
    }

    const finalUrls: string[] = [];
    const shortenerDomains = new Set<string>();

    // Process each URL
    for (const match of matches) {
      let url = match.url;

      // Ensure protocol is present
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `http://${url}`;
      }

      try {
        // Extract hostname from URL
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Check if this is a known shortener
        const isShortener = this.shortenerDomains.some((shortener: string) => {
          return hostname === shortener || hostname.endsWith(`.${shortener}`);
        });

        if (isShortener) {
          // This is a shortener, follow redirects
          this.logger.debug(`Detected shortener: ${hostname} for URL: ${url}`);
          shortenerDomains.add(hostname);

          const redirectResult = await this.redirectService.followRedirects(url);
          finalUrls.push(redirectResult.finalUrl);

          this.logger.debug(
            `Followed ${redirectResult.redirectCount} redirects: ${url} -> ${redirectResult.finalUrl}`,
          );
        } else {
          // Not a shortener, use as-is
          finalUrls.push(url);
        }
      } catch (error) {
        // If URL parsing fails, use original URL
        this.logger.warn(`Failed to process URL ${url}: ${error.message}`);
        finalUrls.push(url);
      }
    }

    // Remove duplicates from final URLs
    return {
      urls: [...new Set(finalUrls)],
      shorteners: [...shortenerDomains],
    };
  }

  /**
   * Extract phone numbers from content using libphonenumber-js
   * Handles various formats: international, local, with separators (. / ( ) -)
   * Uses Belgium (BE) as default country for local number detection
   */
  private extractPhones(content: string): string[] {
    try {
      const allPhones = new Set<string>();

      // Split content by slash and newline to handle cases where phone numbers
      // are separated by slashes (e.g., "31.31.20.72 / 31.31.20.73 / 32475123456")
      // The libphonenumber-js library may stop after the first number when slashes are present
      const segments = content.split(/[\n\/]/);

      for (const segment of segments) {
        // Find all phone numbers in each segment with Belgium as default country
        const phoneNumbers = findPhoneNumbersInText(segment.trim(), 'BE');

        if (phoneNumbers && phoneNumbers.length > 0) {
          // Extract and format phone numbers in international format
          phoneNumbers.forEach((item) => {
            try {
              const phoneNumber: PhoneNumber = item.number;
              // Add to set in international format (E.164) as string
              allPhones.add(phoneNumber.number.toString());
            } catch {
              // Skip invalid numbers
            }
          });
        }
      }

      // Return unique phone numbers as array
      return [...allPhones];
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
