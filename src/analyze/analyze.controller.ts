import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AnalyzeService } from './analyze.service';
import { AnalyzeRequestDto } from './dto/analyze-request.dto';
import { AnalyzeResponseDto } from './dto/analyze-response.dto';

/**
 * Controller for content analysis endpoints
 */
@Controller()
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  /**
   * POST /analyze
   * Analyzes message content and detects language
   *
   * @param request - Analysis request with content and metadata
   * @returns Analysis results with language detection and risk assessment
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  async analyze(@Body() request: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
    return this.analyzeService.analyze(request);
  }
}
