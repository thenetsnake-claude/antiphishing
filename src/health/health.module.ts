import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [TerminusModule, CacheModule],
  controllers: [HealthController],
})
export class HealthModule {}
