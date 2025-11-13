import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { CacheService } from '../cache/cache.service';

/**
 * Health check controller for Kubernetes probes and monitoring
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * GET /health
   * Comprehensive health check including Redis status
   */
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        const isHealthy = await this.cacheService.isHealthy();
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
          },
        };
      },
    ]);
  }

  /**
   * GET /health/readiness
   * Kubernetes readiness probe
   * Returns 200 if service is ready to accept traffic
   */
  @Get('readiness')
  readiness(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * GET /health/liveness
   * Kubernetes liveness probe
   * Returns 200 if service is alive
   */
  @Get('liveness')
  liveness(): { status: string } {
    return { status: 'ok' };
  }
}
