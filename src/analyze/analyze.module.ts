import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze.controller';
import { AnalyzeService } from './analyze.service';
import { CacheModule } from '../cache/cache.module';
import { LanguageService } from '../language/language.service';

@Module({
  imports: [CacheModule],
  controllers: [AnalyzeController],
  providers: [AnalyzeService, LanguageService],
})
export class AnalyzeModule {}
