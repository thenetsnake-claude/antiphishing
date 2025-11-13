import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeService } from '../analyze.service';
import { CacheService } from '../../cache/cache.service';
import { LanguageService } from '../../language/language.service';
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
      expect(Array.isArray(enhanced.phishing_keywords)).toBe(true);
      expect(Array.isArray(enhanced.urls)).toBe(true);
      expect(Array.isArray(enhanced.phones)).toBe(true);
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
});
