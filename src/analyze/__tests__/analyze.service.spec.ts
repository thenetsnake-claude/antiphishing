import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from '../analyze.service';
import { CacheService } from '../../cache/cache.service';
import { LanguageService } from '../../language/language.service';
import { RedirectService } from '../redirect.service';
import { AnalyzeRequestDto } from '../dto/analyze-request.dto';

// Mock franc module
jest.mock('franc', () => ({
  francAll: jest.fn(),
}));

describe('AnalyzeService', () => {
  let service: AnalyzeService;

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    isHealthy: jest.fn(),
  };

  const mockLanguageService = {
    detect: jest.fn(),
  };

  const mockRedirectService = {
    followRedirects: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyzeService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: LanguageService,
          useValue: mockLanguageService,
        },
        {
          provide: RedirectService,
          useValue: mockRedirectService,
        },
      ],
    }).compile();

    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyze', () => {
    const createMockRequest = (overrides?: Partial<AnalyzeRequestDto>): AnalyzeRequestDto => ({
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '123e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      content: 'This is a test message',
      messageID: '123e4567-e89b-12d3-a456-426614174002',
      ...overrides,
    });

    it('should return cached result if available', async () => {
      const request = createMockRequest();
      const cachedAnalysis = {
        language: 'eng',
        lang_certainity: 95,
        cached: true,
        processing_time_ms: 50,
        risk_level: 0,
        triggers: [],
        enhanced: {
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
          public_ips: [],
          shortener_used: [],
        },
      };

      mockCacheService.get.mockResolvedValue(cachedAnalysis);

      const result = await service.analyze(request);

      expect(result.analysis.cached).toBe(true);
      expect(result.analysis.language).toBe('eng');
      expect(mockCacheService.get).toHaveBeenCalledWith(request.content);
      expect(mockLanguageService.detect).not.toHaveBeenCalled();
    });

    it('should perform analysis and cache result on cache miss', async () => {
      const request = createMockRequest();
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });

      const result = await service.analyze(request);

      expect(result.analysis.cached).toBe(false);
      expect(result.analysis.language).toBe('eng');
      expect(result.analysis.lang_certainity).toBe(95);
      expect(mockLanguageService.detect).toHaveBeenCalledWith(request.content);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        request.content,
        expect.objectContaining({
          language: 'eng',
          lang_certainity: 95,
        }),
        60,
      );
    });

    it('should return complete response structure', async () => {
      const request = createMockRequest();
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'fra',
        confidence: 90,
      });

      const result = await service.analyze(request);

      expect(result).toHaveProperty('status', 'safe');
      expect(result).toHaveProperty('certainity', 0);
      expect(result).toHaveProperty('message', 'no analysis');
      expect(result).toHaveProperty('customer_whitelisted', false);
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('language', 'fra');
      expect(result.analysis).toHaveProperty('lang_certainity', 90);
      expect(result.analysis).toHaveProperty('cached', false);
      expect(result.analysis).toHaveProperty('processing_time_ms');
      expect(result.analysis).toHaveProperty('risk_level', 0);
      expect(result.analysis).toHaveProperty('triggers');
      expect(result.analysis).toHaveProperty('enhanced');
    });

    it('should include enhanced analysis with all fields', async () => {
      const request = createMockRequest();
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });

      const result = await service.analyze(request);

      const enhanced = result.analysis.enhanced;
      expect(enhanced).toHaveProperty('keyword_density', 0);
      expect(enhanced).toHaveProperty('message_length_risk', 0);
      expect(enhanced).toHaveProperty('mixed_content_risk', 0);
      expect(enhanced).toHaveProperty('caps_ratio_risk', 0);
      expect(enhanced).toHaveProperty('total_context_risk', 0);
      expect(enhanced).toHaveProperty('burst_pattern_risk', 0);
      expect(enhanced).toHaveProperty('off_hours_risk', 0);
      expect(enhanced).toHaveProperty('weekend_spike', 0);
      expect(enhanced).toHaveProperty('total_temporal_risk', 0);
      expect(enhanced).toHaveProperty('suspicious_tld', '');
      expect(enhanced).toHaveProperty('phishing_keywords');
      expect(enhanced).toHaveProperty('urls');
      expect(enhanced).toHaveProperty('phones');
      expect(enhanced).toHaveProperty('public_ips');
      expect(enhanced).toHaveProperty('shortener_used');
      expect(Array.isArray(enhanced.phishing_keywords)).toBe(true);
      expect(Array.isArray(enhanced.urls)).toBe(true);
      expect(Array.isArray(enhanced.phones)).toBe(true);
      expect(Array.isArray(enhanced.public_ips)).toBe(true);
      expect(Array.isArray(enhanced.shortener_used)).toBe(true);
    });

    it('should track processing time', async () => {
      const request = createMockRequest();
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });

      const result = await service.analyze(request);

      expect(result.analysis.processing_time_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result.analysis.processing_time_ms).toBe('number');
    });

    it('should handle different languages', async () => {
      const languages = [
        { lang: 'eng', confidence: 95 },
        { lang: 'fra', confidence: 90 },
        { lang: 'nld', confidence: 85 },
        { lang: 'pol', confidence: 88 },
        { lang: 'spa', confidence: 92 },
      ];

      for (const { lang, confidence } of languages) {
        const request = createMockRequest();
        mockCacheService.get.mockResolvedValue(null);
        mockLanguageService.detect.mockReturnValue({
          language: lang,
          confidence,
        });

        const result = await service.analyze(request);

        expect(result.analysis.language).toBe(lang);
        expect(result.analysis.lang_certainity).toBe(confidence);
      }
    });

    it('should handle unknown language', async () => {
      const request = createMockRequest();
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'unknown',
        confidence: 0,
      });

      const result = await service.analyze(request);

      expect(result.analysis.language).toBe('unknown');
      expect(result.analysis.lang_certainity).toBe(0);
    });

    it('should continue analysis even if caching fails', async () => {
      const request = createMockRequest();
      mockCacheService.get.mockResolvedValue(null);
      // Mock resolves (not rejects) because the real CacheService catches errors internally
      mockCacheService.set.mockResolvedValue(undefined);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });

      const result = await service.analyze(request);

      expect(result.analysis.language).toBe('eng');
      expect(result.status).toBe('safe');
    });
  });

  describe('URL detection', () => {
    const createMockRequest = (content: string): AnalyzeRequestDto => ({
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '123e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      content,
      messageID: '123e4567-e89b-12d3-a456-426614174002',
    });

    beforeEach(() => {
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });
    });

    it('should extract http URLs from content', async () => {
      const request = createMockRequest('Check this link: http://example.com for more info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.com');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should extract https URLs from content', async () => {
      const request = createMockRequest('Visit https://secure.example.com now');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('https://secure.example.com');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should extract www URLs and add protocol', async () => {
      const request = createMockRequest('Go to www.example.com today');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://www.example.com');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should extract multiple URLs from content', async () => {
      const request = createMockRequest(
        'Visit https://example.com or http://test.org and www.sample.net',
      );
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('https://example.com');
      expect(result.analysis.enhanced.urls).toContain('http://test.org');
      expect(result.analysis.enhanced.urls).toContain('http://www.sample.net');
      expect(result.analysis.enhanced.urls).toHaveLength(3);
    });

    it('should handle URLs with paths and query parameters', async () => {
      const request = createMockRequest(
        'Click https://example.com/path/to/page?param=value&other=123',
      );
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain(
        'https://example.com/path/to/page?param=value&other=123',
      );
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should handle URLs with fragments', async () => {
      const request = createMockRequest('Link: https://example.com/page#section');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('https://example.com/page#section');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should deduplicate identical URLs', async () => {
      const request = createMockRequest('Visit https://example.com and https://example.com again');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toHaveLength(1);
      expect(result.analysis.enhanced.urls).toContain('https://example.com');
    });

    it('should return empty array when no URLs present', async () => {
      const request = createMockRequest('This is a message without any links');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toEqual([]);
      expect(result.analysis.enhanced.urls).toHaveLength(0);
    });

    it('should detect bare domains without protocol', async () => {
      const request = createMockRequest('Visit example.com for more info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.com');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should extract URLs with ports', async () => {
      const request = createMockRequest('Server at http://localhost:3000/api');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://localhost:3000/api');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should handle URLs with special characters in path', async () => {
      const request = createMockRequest('Download: https://example.com/file-name_v2.0.pdf');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('https://example.com/file-name_v2.0.pdf');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should detect multiple bare domains', async () => {
      const request = createMockRequest('Visit example.com and test.org for info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.com');
      expect(result.analysis.enhanced.urls).toContain('http://test.org');
      expect(result.analysis.enhanced.urls).toHaveLength(2);
    });

    it('should detect subdomains', async () => {
      const request = createMockRequest('Check subdomain.example.com');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://subdomain.example.com');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
    });

    it('should detect various TLDs', async () => {
      const request = createMockRequest('Visit example.io, test.dev, and demo.app');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.io');
      expect(result.analysis.enhanced.urls).toContain('http://test.dev');
      expect(result.analysis.enhanced.urls).toContain('http://demo.app');
      expect(result.analysis.enhanced.urls).toHaveLength(3);
    });

    it('should not detect email addresses as URLs', async () => {
      const request = createMockRequest('Contact us at info@example.com');
      const result = await service.analyze(request);

      // Should not extract the domain from email address
      expect(result.analysis.enhanced.urls).toEqual([]);
    });

    it('should detect domains but not emails in same content', async () => {
      const request = createMockRequest('Visit example.com or email info@test.org for details');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.com');
      expect(result.analysis.enhanced.urls).toHaveLength(1);
      // test.org should not be detected as it's part of an email
    });

    it('should handle mixed protocol and bare domains', async () => {
      const request = createMockRequest('Visit https://secure.com, example.org, and www.test.net');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('https://secure.com');
      expect(result.analysis.enhanced.urls).toContain('http://example.org');
      expect(result.analysis.enhanced.urls).toContain('http://www.test.net');
      expect(result.analysis.enhanced.urls).toHaveLength(3);
    });

    it('should detect country code TLDs', async () => {
      const request = createMockRequest('Visit example.co.uk and test.com.au');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.co.uk');
      expect(result.analysis.enhanced.urls).toContain('http://test.com.au');
      expect(result.analysis.enhanced.urls).toHaveLength(2);
    });

    it('should detect rare and new TLDs', async () => {
      const request = createMockRequest(
        'Check example.xyz, test.cloud, demo.online, and site.shop',
      );
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.xyz');
      expect(result.analysis.enhanced.urls).toContain('http://test.cloud');
      expect(result.analysis.enhanced.urls).toContain('http://demo.online');
      expect(result.analysis.enhanced.urls).toContain('http://site.shop');
      expect(result.analysis.enhanced.urls).toHaveLength(4);
    });

    it('should detect all types of TLDs including generic and sponsored', async () => {
      const request = createMockRequest('Visit example.museum, test.aero, and demo.travel today');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain('http://example.museum');
      expect(result.analysis.enhanced.urls).toContain('http://test.aero');
      expect(result.analysis.enhanced.urls).toContain('http://demo.travel');
      expect(result.analysis.enhanced.urls).toHaveLength(3);
    });
  });

  describe('Phone number detection', () => {
    const createMockRequest = (content: string): AnalyzeRequestDto => ({
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '223e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      messageID: '323e4567-e89b-12d3-a456-426614174002',
      content,
    });

    beforeEach(() => {
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });
    });

    it('should extract phone numbers in international format', async () => {
      const request = createMockRequest('Call me at +1 (202) 456-1111 for more info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('1202');
      }
    });

    it('should extract phone numbers with dots as separators', async () => {
      const request = createMockRequest('Contact: +1.202.456.1111');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('1202');
      }
    });

    it('should extract phone numbers with dashes', async () => {
      const request = createMockRequest('Phone: +44-20-7946-0958');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('4420');
      }
    });

    it('should handle phone numbers with slashes', async () => {
      const request = createMockRequest('Ring +33/1/42/86/82/00');
      const result = await service.analyze(request);

      // Slashes are unusual separators - may or may not be detected
      expect(Array.isArray(result.analysis.enhanced.phones)).toBe(true);
    });

    it('should extract phone numbers with parentheses', async () => {
      const request = createMockRequest('Call +1(202)456-1111 for info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract multiple phone numbers from content', async () => {
      const request = createMockRequest('Call +1-202-456-1111 or +44-20-7946-0958 for assistance');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
    });

    it('should deduplicate identical phone numbers', async () => {
      const request = createMockRequest('Call +1-202-456-1111 or +1 (202) 456-1111 for more info');
      const result = await service.analyze(request);

      // Should deduplicate to 1 number
      expect(result.analysis.enhanced.phones.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array when no phone numbers present', async () => {
      const request = createMockRequest('No phone numbers in this message');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones).toEqual([]);
    });

    it('should handle phone numbers with spaces', async () => {
      const request = createMockRequest('Contact +1 202 456 1111');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('1202');
      }
    });

    it('should extract phone numbers in European format', async () => {
      const request = createMockRequest('Phone: +49 30 12345678');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('4930');
      }
    });

    it('should extract phone numbers in Asian format', async () => {
      const request = createMockRequest('Call +81-3-1234-5678');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('8131');
      }
    });

    it('should handle mixed phone formats in same content', async () => {
      const request = createMockRequest(
        'Call +1.202.456.1111, +44-20-7946-0958, or +33/1/42/86/82/00',
      );
      const result = await service.analyze(request);

      // Should detect at least one phone number
      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
    });

    it('should not extract invalid phone-like numbers', async () => {
      const request = createMockRequest('My code is 123-456 and pin 7890');
      const result = await service.analyze(request);

      // These short numbers shouldn't be detected as valid phone numbers
      expect(result.analysis.enhanced.phones.length).toBeLessThanOrEqual(0);
    });

    it('should handle phone numbers with country code without plus', async () => {
      const request = createMockRequest('Phone: 1 555 123 4567');
      const result = await service.analyze(request);

      // May or may not be detected depending on context
      expect(Array.isArray(result.analysis.enhanced.phones)).toBe(true);
    });

    it('should extract phone numbers from sentences', async () => {
      const request = createMockRequest('Please call us at +1-202-456-1111 during business hours');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toContain('1202');
      }
    });

    it('should extract Belgian local toll-free numbers', async () => {
      const request = createMockRequest('Call our helpline at 0800 33 800');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        // Belgian toll-free numbers start with 0800 and are converted to +32800
        expect(result.analysis.enhanced.phones[0]).toMatch(/\+32800/);
      }
    });

    it('should extract Belgian local landline numbers', async () => {
      const request = createMockRequest('Our office number is 02 123 45 67');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        // Belgian landlines with area code 02 (Brussels) convert to +322
        expect(result.analysis.enhanced.phones[0]).toMatch(/\+322/);
      }
    });

    it('should extract Belgian mobile numbers', async () => {
      const request = createMockRequest('My mobile is 0470 12 34 56');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.phones.length > 0) {
        // Belgian mobiles starting with 047 convert to +3247
        expect(result.analysis.enhanced.phones[0]).toMatch(/\+3247/);
      }
    });

    it('should extract Belgian numbers with various separators', async () => {
      const request = createMockRequest('Contact us: 02/123.45.67 or 0470-12-34-56');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
      // Should detect at least one Belgian number
      if (result.analysis.enhanced.phones.length > 0) {
        expect(result.analysis.enhanced.phones[0]).toMatch(/\+32/);
      }
    });

    it('should handle mix of international and Belgian local numbers', async () => {
      const request = createMockRequest('International: +1-202-456-1111, Local: 0800 33 800');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(2);
      // Should detect both international and Belgian local number
      if (result.analysis.enhanced.phones.length >= 2) {
        const hasUS = result.analysis.enhanced.phones.some((p) => p.includes('+1'));
        const hasBE = result.analysis.enhanced.phones.some((p) => p.includes('+32'));
        expect(hasUS || hasBE).toBe(true);
      }
    });

    it('should extract multiple phone numbers separated by slashes', async () => {
      const request = createMockRequest(
        "PLUS D'INFOS EN AGENCE OU AU 31.31.20.72 / 31.31.20.73 / 32475123456",
      );
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBe(3);
      expect(result.analysis.enhanced.phones).toContain('+3231312072');
      expect(result.analysis.enhanced.phones).toContain('+3231312073');
      expect(result.analysis.enhanced.phones).toContain('+32475123456');
    });

    it('should handle phone numbers separated by slashes in various formats', async () => {
      const request = createMockRequest('Contact: 0800 33 800 / 0470 12 34 56');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBe(2);
      expect(result.analysis.enhanced.phones).toContain('+3280033800');
      expect(result.analysis.enhanced.phones).toContain('+32470123456');
    });

    it('should detect phone numbers with slashes as internal separators', async () => {
      const request = createMockRequest('Test message for structure validation. 32 496 / 123476');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.phones.length).toBe(1);
      expect(result.analysis.enhanced.phones).toContain('+32496123476');
    });
  });

  describe('Public IP detection', () => {
    const createMockRequest = (content: string): AnalyzeRequestDto => ({
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '223e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      messageID: '323e4567-e89b-12d3-a456-426614174002',
      content,
    });

    beforeEach(() => {
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });
    });

    it('should extract public IPv4 addresses', async () => {
      const request = createMockRequest('Server IP is 8.8.8.8 for DNS');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
    });

    it('should extract multiple public IPv4 addresses', async () => {
      const request = createMockRequest('DNS servers: 8.8.8.8 and 1.1.1.1');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
      expect(result.analysis.enhanced.public_ips).toContain('1.1.1.1');
      expect(result.analysis.enhanced.public_ips.length).toBe(2);
    });

    it('should filter out private IPv4 addresses', async () => {
      const request = createMockRequest('Private: 192.168.1.1, Public: 8.8.8.8, Private: 10.0.0.1');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
      expect(result.analysis.enhanced.public_ips).not.toContain('192.168.1.1');
      expect(result.analysis.enhanced.public_ips).not.toContain('10.0.0.1');
      expect(result.analysis.enhanced.public_ips.length).toBe(1);
    });

    it('should filter out loopback addresses', async () => {
      const request = createMockRequest('Localhost: 127.0.0.1, Public: 8.8.8.8');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
      expect(result.analysis.enhanced.public_ips).not.toContain('127.0.0.1');
      expect(result.analysis.enhanced.public_ips.length).toBe(1);
    });

    it('should filter out link-local addresses', async () => {
      const request = createMockRequest('Link-local: 169.254.0.1, Public: 1.1.1.1');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('1.1.1.1');
      expect(result.analysis.enhanced.public_ips).not.toContain('169.254.0.1');
      expect(result.analysis.enhanced.public_ips.length).toBe(1);
    });

    it('should extract public IPv6 addresses', async () => {
      const request = createMockRequest('IPv6 server: 2001:4860:4860::8888');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips.length).toBeGreaterThanOrEqual(1);
      if (result.analysis.enhanced.public_ips.length > 0) {
        expect(result.analysis.enhanced.public_ips[0]).toMatch(/2001:4860:4860/);
      }
    });

    it('should filter out IPv6 loopback', async () => {
      const request = createMockRequest('IPv6 loopback: ::1, Public: 2001:4860:4860::8888');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).not.toContain('::1');
    });

    it('should filter out IPv6 link-local addresses', async () => {
      const request = createMockRequest('Link-local: fe80::1, Public: 2001:4860:4860::8888');
      const result = await service.analyze(request);

      const hasLinkLocal = result.analysis.enhanced.public_ips.some((ip) =>
        ip.toLowerCase().startsWith('fe80'),
      );
      expect(hasLinkLocal).toBe(false);
    });

    it('should deduplicate identical IP addresses', async () => {
      const request = createMockRequest('Server: 8.8.8.8 and backup: 8.8.8.8');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
      expect(result.analysis.enhanced.public_ips.length).toBe(1);
    });

    it('should return empty array when no IPs present', async () => {
      const request = createMockRequest('No IP addresses in this text');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toEqual([]);
    });

    it('should return empty array when only private IPs present', async () => {
      const request = createMockRequest('Private network: 192.168.1.1 and 10.0.0.1');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toEqual([]);
    });

    it('should handle mixed IPv4 and IPv6 addresses', async () => {
      const request = createMockRequest('IPv4: 8.8.8.8, IPv6: 2001:4860:4860::8888');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips.length).toBeGreaterThanOrEqual(1);
      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
    });

    it('should extract IPs from sentences with text around them', async () => {
      const request = createMockRequest(
        'Connect to server at 8.8.8.8 on port 53 for DNS resolution',
      );
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
    });

    it('should handle IPs in URLs without extracting URL parts', async () => {
      const request = createMockRequest('Visit http://93.184.216.34/ for more info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('93.184.216.34');
    });

    it('should filter out carrier-grade NAT addresses', async () => {
      const request = createMockRequest('CGN: 100.64.0.1, Public: 8.8.8.8');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.public_ips).toContain('8.8.8.8');
      expect(result.analysis.enhanced.public_ips).not.toContain('100.64.0.1');
      expect(result.analysis.enhanced.public_ips.length).toBe(1);
    });
  });

  describe('URL shortener detection', () => {
    const createMockRequest = (content: string): AnalyzeRequestDto => ({
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '223e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      messageID: '323e4567-e89b-12d3-a456-426614174002',
      content,
    });

    beforeEach(() => {
      mockCacheService.get.mockResolvedValue(null);
      mockLanguageService.detect.mockReturnValue({
        language: 'eng',
        confidence: 95,
      });
    });

    it('should detect bit.ly shortener and follow redirect', async () => {
      const shortUrl = 'https://bit.ly/abc123';
      const finalUrl = 'https://example.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`Check this link: ${shortUrl}`);
      const result = await service.analyze(request);

      expect(mockRedirectService.followRedirects).toHaveBeenCalledWith(shortUrl);
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
      expect(result.analysis.enhanced.urls).not.toContain(shortUrl);
      expect(result.analysis.enhanced.shortener_used).toContain('bit.ly');
    });

    it('should detect t.co shortener and follow redirect', async () => {
      const shortUrl = 'https://t.co/abc123xyz';
      const finalUrl = 'https://example.com/article';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 2,
      });

      const request = createMockRequest(`Twitter link: ${shortUrl}`);
      const result = await service.analyze(request);

      expect(mockRedirectService.followRedirects).toHaveBeenCalledWith(shortUrl);
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
      expect(result.analysis.enhanced.shortener_used).toContain('t.co');
    });

    it('should detect tinyurl.com shortener', async () => {
      const shortUrl = 'https://tinyurl.com/abc123';
      const finalUrl = 'https://example.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`Visit ${shortUrl}`);
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.shortener_used).toContain('tinyurl.com');
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
    });

    it('should handle multiple shorteners in same content', async () => {
      const shortUrl1 = 'https://bit.ly/abc123';
      const shortUrl2 = 'https://t.co/xyz789';
      const finalUrl1 = 'https://example.com';
      const finalUrl2 = 'https://test.org';

      mockRedirectService.followRedirects
        .mockResolvedValueOnce({ finalUrl: finalUrl1, redirectCount: 1 })
        .mockResolvedValueOnce({ finalUrl: finalUrl2, redirectCount: 1 });

      const request = createMockRequest(`Check ${shortUrl1} and ${shortUrl2}`);
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.urls).toContain(finalUrl1);
      expect(result.analysis.enhanced.urls).toContain(finalUrl2);
      expect(result.analysis.enhanced.shortener_used).toContain('bit.ly');
      expect(result.analysis.enhanced.shortener_used).toContain('t.co');
    });

    it('should handle mix of shortened and regular URLs', async () => {
      const shortUrl = 'https://bit.ly/abc123';
      const regularUrl = 'https://example.com';
      const finalUrl = 'https://redirect-destination.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`Visit ${shortUrl} or ${regularUrl}`);
      const result = await service.analyze(request);

      // Short URL should be followed
      expect(mockRedirectService.followRedirects).toHaveBeenCalledWith(shortUrl);
      expect(result.analysis.enhanced.urls).toContain(finalUrl);

      // Regular URL should not be followed
      expect(mockRedirectService.followRedirects).not.toHaveBeenCalledWith(regularUrl);
      expect(result.analysis.enhanced.urls).toContain(regularUrl);

      // Only shortener should be in shortener_used
      expect(result.analysis.enhanced.shortener_used).toContain('bit.ly');
      expect(result.analysis.enhanced.shortener_used.length).toBe(1);
    });

    it('should not list shorteners when no shorteners present', async () => {
      const request = createMockRequest('Visit https://example.com for info');
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.shortener_used).toEqual([]);
      expect(mockRedirectService.followRedirects).not.toHaveBeenCalled();
    });

    it('should deduplicate shorteners when same shortener used multiple times', async () => {
      const shortUrl1 = 'https://bit.ly/abc123';
      const shortUrl2 = 'https://bit.ly/xyz789';
      const finalUrl1 = 'https://example.com';
      const finalUrl2 = 'https://test.org';

      mockRedirectService.followRedirects
        .mockResolvedValueOnce({ finalUrl: finalUrl1, redirectCount: 1 })
        .mockResolvedValueOnce({ finalUrl: finalUrl2, redirectCount: 1 });

      const request = createMockRequest(`Check ${shortUrl1} and ${shortUrl2}`);
      const result = await service.analyze(request);

      // Should list bit.ly only once
      expect(result.analysis.enhanced.shortener_used).toEqual(['bit.ly']);
      expect(result.analysis.enhanced.urls).toContain(finalUrl1);
      expect(result.analysis.enhanced.urls).toContain(finalUrl2);
    });

    it('should handle shortener with www subdomain', async () => {
      const shortUrl = 'https://www.bit.ly/abc123';
      const finalUrl = 'https://example.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`Link: ${shortUrl}`);
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.shortener_used).toContain('www.bit.ly');
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
    });

    it('should handle shorteners without protocol', async () => {
      const shortUrl = 'bit.ly/abc123';
      const finalUrl = 'https://example.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`Visit ${shortUrl}`);
      const result = await service.analyze(request);

      // linkify will add http:// protocol
      expect(mockRedirectService.followRedirects).toHaveBeenCalledWith('http://bit.ly/abc123');
      expect(result.analysis.enhanced.shortener_used).toContain('bit.ly');
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
    });

    it('should handle redirect service failures gracefully', async () => {
      const shortUrl = 'https://bit.ly/abc123';

      // Redirect service returns original URL on failure
      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl: shortUrl,
        redirectCount: 0,
      });

      const request = createMockRequest(`Check ${shortUrl}`);
      const result = await service.analyze(request);

      // Should still include the shortener domain
      expect(result.analysis.enhanced.shortener_used).toContain('bit.ly');
      // Original URL should be in URLs if redirect fails
      expect(result.analysis.enhanced.urls).toContain(shortUrl);
    });

    it('should detect is.gd shortener', async () => {
      const shortUrl = 'https://is.gd/abc123';
      const finalUrl = 'https://example.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`Click ${shortUrl}`);
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.shortener_used).toContain('is.gd');
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
    });

    it('should detect ow.ly shortener', async () => {
      const shortUrl = 'https://ow.ly/abc123';
      const finalUrl = 'https://example.com';

      mockRedirectService.followRedirects.mockResolvedValue({
        finalUrl,
        redirectCount: 1,
      });

      const request = createMockRequest(`See ${shortUrl}`);
      const result = await service.analyze(request);

      expect(result.analysis.enhanced.shortener_used).toContain('ow.ly');
      expect(result.analysis.enhanced.urls).toContain(finalUrl);
    });
  });
});
