import { AnalyzeResponseDto, AnalysisDto, EnhancedAnalysisDto } from '../analyze-response.dto';

describe('DTO Classes', () => {
  describe('EnhancedAnalysisDto', () => {
    it('should create an instance with all properties', () => {
      const dto = new EnhancedAnalysisDto();
      dto.keyword_density = 0;
      dto.message_length_risk = 0;
      dto.mixed_content_risk = 0;
      dto.caps_ratio_risk = 0;
      dto.total_context_risk = 0;
      dto.burst_pattern_risk = 0;
      dto.off_hours_risk = 0;
      dto.weekend_spike = 0;
      dto.total_temporal_risk = 0;
      dto.suspicious_tld = '';
      dto.phishing_keywords = [];
      dto.urls = [];
      dto.phones = [];

      expect(dto).toBeDefined();
      expect(dto.keyword_density).toBe(0);
      expect(dto.urls).toEqual([]);
      expect(dto.phones).toEqual([]);
    });

    it('should allow setting URL values', () => {
      const dto = new EnhancedAnalysisDto();
      dto.urls = ['http://example.com', 'https://test.org'];

      expect(dto.urls).toHaveLength(2);
      expect(dto.urls[0]).toBe('http://example.com');
      expect(dto.urls[1]).toBe('https://test.org');
    });

    it('should allow setting all risk values', () => {
      const dto = new EnhancedAnalysisDto();
      dto.keyword_density = 5;
      dto.message_length_risk = 10;
      dto.mixed_content_risk = 15;
      dto.caps_ratio_risk = 20;
      dto.total_context_risk = 50;
      dto.burst_pattern_risk = 25;
      dto.off_hours_risk = 30;
      dto.weekend_spike = 35;
      dto.total_temporal_risk = 90;

      expect(dto.keyword_density).toBe(5);
      expect(dto.message_length_risk).toBe(10);
      expect(dto.total_context_risk).toBe(50);
      expect(dto.total_temporal_risk).toBe(90);
    });
  });

  describe('AnalysisDto', () => {
    it('should create an instance with all properties', () => {
      const enhanced = new EnhancedAnalysisDto();
      enhanced.urls = [];
      enhanced.phones = [];
      enhanced.phishing_keywords = [];

      const dto = new AnalysisDto();
      dto.language = 'eng';
      dto.lang_certainity = 95;
      dto.cached = false;
      dto.processing_time_ms = 50;
      dto.risk_level = 0;
      dto.triggers = [];
      dto.enhanced = enhanced;

      expect(dto).toBeDefined();
      expect(dto.language).toBe('eng');
      expect(dto.lang_certainity).toBe(95);
      expect(dto.cached).toBe(false);
      expect(dto.enhanced).toBeDefined();
    });

    it('should allow different language codes', () => {
      const dto = new AnalysisDto();

      dto.language = 'fra';
      expect(dto.language).toBe('fra');

      dto.language = 'nld';
      expect(dto.language).toBe('nld');

      dto.language = 'unknown';
      expect(dto.language).toBe('unknown');
    });

    it('should handle cached responses', () => {
      const dto = new AnalysisDto();
      dto.cached = true;
      dto.processing_time_ms = 5;

      expect(dto.cached).toBe(true);
      expect(dto.processing_time_ms).toBeLessThan(10);
    });
  });

  describe('AnalyzeResponseDto', () => {
    it('should create a complete response', () => {
      const enhanced = new EnhancedAnalysisDto();
      enhanced.urls = ['http://example.com'];
      enhanced.phones = [];
      enhanced.phishing_keywords = [];
      enhanced.keyword_density = 0;
      enhanced.message_length_risk = 0;
      enhanced.mixed_content_risk = 0;
      enhanced.caps_ratio_risk = 0;
      enhanced.total_context_risk = 0;
      enhanced.burst_pattern_risk = 0;
      enhanced.off_hours_risk = 0;
      enhanced.weekend_spike = 0;
      enhanced.total_temporal_risk = 0;
      enhanced.suspicious_tld = '';

      const analysis = new AnalysisDto();
      analysis.language = 'eng';
      analysis.lang_certainity = 95;
      analysis.cached = false;
      analysis.processing_time_ms = 50;
      analysis.risk_level = 0;
      analysis.triggers = [];
      analysis.enhanced = enhanced;

      const response = new AnalyzeResponseDto();
      response.status = 'safe';
      response.certainity = 0;
      response.message = 'no analysis';
      response.customer_whitelisted = false;
      response.analysis = analysis;

      expect(response).toBeDefined();
      expect(response.status).toBe('safe');
      expect(response.certainity).toBe(0);
      expect(response.customer_whitelisted).toBe(false);
      expect(response.analysis.language).toBe('eng');
      expect(response.analysis.enhanced.urls).toContain('http://example.com');
    });

    it('should have proper structure', () => {
      const analysis = new AnalysisDto();

      const response = new AnalyzeResponseDto();
      response.status = 'safe';
      response.certainity = 0;
      response.message = 'no analysis';
      response.customer_whitelisted = false;
      response.analysis = analysis;

      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('certainity');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('customer_whitelisted');
      expect(response).toHaveProperty('analysis');
    });
  });
});
