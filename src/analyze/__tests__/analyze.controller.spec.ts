import { Test, TestingModule } from '@nestjs/testing';
import { AnalyzeController } from '../analyze.controller';
import { AnalyzeService } from '../analyze.service';
import { AnalyzeRequestDto } from '../dto/analyze-request.dto';

describe('AnalyzeController', () => {
  let controller: AnalyzeController;
  let service: AnalyzeService;

  const mockAnalyzeService = {
    analyze: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyzeController],
      providers: [
        {
          provide: AnalyzeService,
          useValue: mockAnalyzeService,
        },
      ],
    }).compile();

    controller = module.get<AnalyzeController>(AnalyzeController);
    service = module.get<AnalyzeService>(AnalyzeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('analyze', () => {
    const createMockRequest = (): AnalyzeRequestDto => ({
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '123e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      content: 'This is a test message',
      messageID: '123e4567-e89b-12d3-a456-426614174002',
    });

    const createMockResponse = () => ({
      status: 'safe',
      certainity: 0,
      message: 'no analysis',
      customer_whitelisted: false,
      analysis: {
        language: 'eng',
        lang_certainity: 95,
        cached: false,
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
      },
    });

    it('should call analyze service with request', async () => {
      const request = createMockRequest();
      const response = createMockResponse();
      mockAnalyzeService.analyze.mockResolvedValue(response);

      const result = await controller.analyze(request);

      expect(service.analyze).toHaveBeenCalledWith(request);
      expect(result).toEqual(response);
    });

    it('should return analysis result', async () => {
      const request = createMockRequest();
      const response = createMockResponse();
      mockAnalyzeService.analyze.mockResolvedValue(response);

      const result = await controller.analyze(request);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('analysis');
      expect(result.analysis).toHaveProperty('language');
    });

    it('should propagate errors from service', async () => {
      const request = createMockRequest();
      const error = new Error('Service error');
      mockAnalyzeService.analyze.mockRejectedValue(error);

      await expect(controller.analyze(request)).rejects.toThrow('Service error');
    });
  });
});
