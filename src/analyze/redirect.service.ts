import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import { CacheService } from '../cache/cache.service';

/**
 * Service for following URL redirects
 * Handles shortened URLs and caches redirect results
 */
@Injectable()
export class RedirectService {
  private readonly logger = new Logger(RedirectService.name);
  private readonly MAX_REDIRECTS = 10;
  private readonly TIMEOUT_MS = 2000; // 2 seconds per request
  private readonly CACHE_TTL = 86400; // 24 hours
  private readonly CACHE_PREFIX = 'redirect:';

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Follow URL redirects to find the final destination
   * Returns the final URL after following all redirects
   */
  async followRedirects(url: string): Promise<{ finalUrl: string; redirectCount: number }> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${url}`;
      const cached = await this.cacheService.get<{ finalUrl: string; redirectCount: number }>(
        cacheKey,
        1, // Use DB index 1 for redirect caching
      );

      if (cached) {
        this.logger.debug(`Redirect cache hit for ${url} -> ${cached.finalUrl}`);
        return cached;
      }

      // Follow redirects
      let currentUrl = url;
      let redirectCount = 0;
      const visitedUrls = new Set<string>();

      while (redirectCount < this.MAX_REDIRECTS) {
        // Prevent infinite loops
        if (visitedUrls.has(currentUrl)) {
          this.logger.warn(`Redirect loop detected for ${url}`);
          break;
        }

        visitedUrls.add(currentUrl);

        try {
          // Make HEAD request to check for redirects without downloading body
          const response = await axios.head(currentUrl, {
            maxRedirects: 0, // Don't auto-follow redirects
            validateStatus: (status) => status >= 200 && status < 400, // Accept redirects
            timeout: this.TIMEOUT_MS,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (compatible; AntiphishingBot/1.0; +https://antiphishing.example.com)',
            },
          } as AxiosRequestConfig);

          // Check if response is a redirect
          if (response.status >= 300 && response.status < 400 && response.headers.location) {
            const location = response.headers.location;

            // Handle relative URLs
            let nextUrl: string;
            if (location.startsWith('http://') || location.startsWith('https://')) {
              nextUrl = location;
            } else if (location.startsWith('/')) {
              // Absolute path
              const urlObj = new URL(currentUrl);
              nextUrl = `${urlObj.protocol}//${urlObj.host}${location}`;
            } else {
              // Relative path
              const urlObj = new URL(currentUrl);
              const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
              nextUrl = `${urlObj.protocol}//${urlObj.host}${basePath}${location}`;
            }

            this.logger.debug(
              `Redirect ${redirectCount + 1}: ${currentUrl} -> ${nextUrl} (${response.status})`,
            );
            currentUrl = nextUrl;
            redirectCount++;
          } else {
            // No redirect, this is the final URL
            break;
          }
        } catch (error) {
          // If HEAD fails, try GET with range header to minimize data transfer
          try {
            const response = await axios.get(currentUrl, {
              maxRedirects: 0,
              validateStatus: (status) => status >= 200 && status < 400,
              timeout: this.TIMEOUT_MS,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (compatible; AntiphishingBot/1.0; +https://antiphishing.example.com)',
                Range: 'bytes=0-0', // Request only first byte
              },
            } as AxiosRequestConfig);

            if (response.status >= 300 && response.status < 400 && response.headers.location) {
              const location = response.headers.location;
              let nextUrl: string;

              if (location.startsWith('http://') || location.startsWith('https://')) {
                nextUrl = location;
              } else if (location.startsWith('/')) {
                const urlObj = new URL(currentUrl);
                nextUrl = `${urlObj.protocol}//${urlObj.host}${location}`;
              } else {
                const urlObj = new URL(currentUrl);
                const basePath = urlObj.pathname.substring(
                  0,
                  urlObj.pathname.lastIndexOf('/') + 1,
                );
                nextUrl = `${urlObj.protocol}//${urlObj.host}${basePath}${location}`;
              }

              currentUrl = nextUrl;
              redirectCount++;
            } else {
              break;
            }
          } catch (getError) {
            // If both HEAD and GET fail, return current URL
            this.logger.warn(`Failed to follow redirect for ${currentUrl}: ${getError.message}`);
            break;
          }
        }
      }

      if (redirectCount >= this.MAX_REDIRECTS) {
        this.logger.warn(`Max redirects (${this.MAX_REDIRECTS}) reached for ${url}`);
      }

      const result = { finalUrl: currentUrl, redirectCount };

      // Cache the result
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL, 1);

      return result;
    } catch (error) {
      this.logger.error(`Error following redirects for ${url}: ${error.message}`);
      // Return original URL if redirect following fails
      return { finalUrl: url, redirectCount: 0 };
    }
  }
}
