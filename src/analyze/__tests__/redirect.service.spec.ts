import { Test, TestingModule } from '@nestjs/testing';
import { RedirectService } from '../redirect.service';
import { CacheService } from '../../cache/cache.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RedirectService', () => {
  let service: RedirectService;

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedirectService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<RedirectService>(RedirectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('followRedirects', () => {
    it('should return cached result if available', async () => {
      const url = 'https://bit.ly/abc123';
      const cachedResult = {
        finalUrl: 'https://example.com',
        redirectCount: 1,
      };

      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await service.followRedirects(url);

      expect(result).toEqual(cachedResult);
      expect(mockCacheService.get).toHaveBeenCalledWith('redirect:' + url, 1);
      expect(mockedAxios.head).not.toHaveBeenCalled();
    });

    it('should follow a single redirect', async () => {
      const url = 'https://bit.ly/abc123';
      const finalUrl = 'https://example.com';

      mockCacheService.get.mockResolvedValue(null);

      // First request returns redirect
      mockedAxios.head.mockResolvedValueOnce({
        status: 301,
        headers: {
          location: finalUrl,
        },
      } as any);

      // Second request returns success
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      const result = await service.followRedirects(url);

      expect(result.finalUrl).toBe(finalUrl);
      expect(result.redirectCount).toBe(1);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'redirect:' + url,
        expect.objectContaining({ finalUrl, redirectCount: 1 }),
        86400,
        1,
      );
    });

    it('should follow multiple redirects', async () => {
      const url = 'https://bit.ly/abc123';
      const redirect1 = 'https://redirect1.com';
      const redirect2 = 'https://redirect2.com';
      const finalUrl = 'https://example.com';

      mockCacheService.get.mockResolvedValue(null);

      // First redirect
      mockedAxios.head.mockResolvedValueOnce({
        status: 301,
        headers: { location: redirect1 },
      } as any);

      // Second redirect
      mockedAxios.head.mockResolvedValueOnce({
        status: 302,
        headers: { location: redirect2 },
      } as any);

      // Third redirect
      mockedAxios.head.mockResolvedValueOnce({
        status: 307,
        headers: { location: finalUrl },
      } as any);

      // Final response
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      const result = await service.followRedirects(url);

      expect(result.finalUrl).toBe(finalUrl);
      expect(result.redirectCount).toBe(3);
    });

    it('should stop at max redirects', async () => {
      const url = 'https://bit.ly/abc123';

      mockCacheService.get.mockResolvedValue(null);

      // Mock 15 redirects (more than MAX_REDIRECTS = 10)
      for (let i = 0; i < 15; i++) {
        mockedAxios.head.mockResolvedValueOnce({
          status: 301,
          headers: { location: `https://redirect${i}.com` },
        } as any);
      }

      const result = await service.followRedirects(url);

      expect(result.redirectCount).toBe(10);
      // Should stop at the 10th redirect URL
      expect(result.finalUrl).toContain('redirect');
    });

    it('should detect and break redirect loops', async () => {
      const url = 'https://bit.ly/abc123';
      const redirect1 = 'https://redirect1.com';

      mockCacheService.get.mockResolvedValue(null);

      // Create a redirect loop by mocking HEAD to always redirect between two URLs
      mockedAxios.head.mockImplementation((requestUrl: string) => {
        if (requestUrl === url) {
          return Promise.resolve({
            status: 301,
            headers: { location: redirect1 },
          } as any);
        } else {
          return Promise.resolve({
            status: 301,
            headers: { location: url }, // Loop back to original
          } as any);
        }
      });

      const result = await service.followRedirects(url);

      // Should detect the loop and stop early
      expect(result.redirectCount).toBeLessThan(10);
      // URL should be one of the URLs in the loop
      expect([url, redirect1]).toContain(result.finalUrl);
    });

    it('should handle relative redirect paths', async () => {
      const url = 'https://example.com/short';
      const relativeRedirect = '/full-path';
      const expectedFinalUrl = 'https://example.com/full-path';

      mockCacheService.get.mockResolvedValue(null);

      // Redirect with relative path
      mockedAxios.head.mockResolvedValueOnce({
        status: 302,
        headers: { location: relativeRedirect },
      } as any);

      // Final response
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      const result = await service.followRedirects(url);

      expect(result.finalUrl).toBe(expectedFinalUrl);
      expect(result.redirectCount).toBe(1);
    });

    it('should fallback to GET when HEAD fails', async () => {
      const url = 'https://bit.ly/abc123';
      const finalUrl = 'https://example.com';

      mockCacheService.get.mockResolvedValue(null);

      // HEAD request fails
      mockedAxios.head.mockRejectedValueOnce(new Error('HEAD not supported'));

      // GET with Range header succeeds
      mockedAxios.get.mockResolvedValueOnce({
        status: 301,
        headers: { location: finalUrl },
      } as any);

      // Final HEAD succeeds
      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      const result = await service.followRedirects(url);

      expect(result.finalUrl).toBe(finalUrl);
      expect(result.redirectCount).toBe(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            Range: 'bytes=0-0',
          }),
        }),
      );
    });

    it('should return original URL if redirect following fails', async () => {
      const url = 'https://bit.ly/abc123';

      mockCacheService.get.mockResolvedValue(null);

      // Both HEAD and GET fail
      mockedAxios.head.mockRejectedValue(new Error('Network error'));
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const result = await service.followRedirects(url);

      expect(result.finalUrl).toBe(url);
      expect(result.redirectCount).toBe(0);
    });

    it('should handle timeout errors gracefully', async () => {
      const url = 'https://bit.ly/abc123';

      mockCacheService.get.mockResolvedValue(null);

      // Simulate timeout
      mockedAxios.head.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });

      const result = await service.followRedirects(url);

      expect(result.finalUrl).toBe(url);
      expect(result.redirectCount).toBe(0);
    });

    it('should cache the redirect result', async () => {
      const url = 'https://bit.ly/abc123';
      const finalUrl = 'https://example.com';

      mockCacheService.get.mockResolvedValue(null);

      mockedAxios.head.mockResolvedValueOnce({
        status: 301,
        headers: { location: finalUrl },
      } as any);

      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      await service.followRedirects(url);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'redirect:' + url,
        expect.objectContaining({
          finalUrl,
          redirectCount: 1,
        }),
        86400, // 24 hours
        1, // DB index 1
      );
    });

    it('should use correct timeout configuration', async () => {
      const url = 'https://bit.ly/abc123';

      mockCacheService.get.mockResolvedValue(null);

      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      await service.followRedirects(url);

      expect(mockedAxios.head).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          timeout: 2000, // 2 seconds
        }),
      );
    });

    it('should set maxRedirects to 0 to handle redirects manually', async () => {
      const url = 'https://bit.ly/abc123';

      mockCacheService.get.mockResolvedValue(null);

      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      await service.followRedirects(url);

      expect(mockedAxios.head).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          maxRedirects: 0,
        }),
      );
    });

    it('should include user agent in requests', async () => {
      const url = 'https://bit.ly/abc123';

      mockCacheService.get.mockResolvedValue(null);

      mockedAxios.head.mockResolvedValueOnce({
        status: 200,
        headers: {},
      } as any);

      await service.followRedirects(url);

      expect(mockedAxios.head).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('AntiphishingBot'),
          }),
        }),
      );
    });
  });
});
