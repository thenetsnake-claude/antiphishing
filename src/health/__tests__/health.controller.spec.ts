import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '../health.controller';
import { CacheService } from '../../cache/cache.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockCacheService = {
    isHealthy: jest.fn(),
  };

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health status with Redis up', async () => {
      mockCacheService.isHealthy.mockResolvedValue(true);
      mockHealthCheckService.check.mockImplementation(async (checks) => {
        const results = await Promise.all(checks.map((check: () => Promise<unknown>) => check()));
        return {
          status: 'ok',
          info: results[0],
          error: {},
          details: results[0],
        };
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(mockCacheService.isHealthy).toHaveBeenCalled();
    });

    it('should return health status with Redis down', async () => {
      mockCacheService.isHealthy.mockResolvedValue(false);
      mockHealthCheckService.check.mockImplementation(async (checks) => {
        const results = await Promise.all(checks.map((check: () => Promise<unknown>) => check()));
        return {
          status: 'ok',
          info: results[0],
          error: {},
          details: results[0],
        };
      });

      await controller.check();

      expect(mockCacheService.isHealthy).toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('should return ok status', () => {
      const result = controller.readiness();

      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('liveness', () => {
    it('should return ok status', () => {
      const result = controller.liveness();

      expect(result).toEqual({ status: 'ok' });
    });
  });
});
