/**
 * Enhanced analysis metrics (all placeholder values for now)
 */
export class EnhancedAnalysisDto {
  keyword_density: number;
  message_length_risk: number;
  mixed_content_risk: number;
  caps_ratio_risk: number;
  total_context_risk: number;
  burst_pattern_risk: number;
  off_hours_risk: number;
  weekend_spike: number;
  total_temporal_risk: number;
  suspicious_tld: string;
  phishing_keywords: string[];
  urls: string[];
  phones: string[];
  public_ips: string[];
  shortener_used: string[];
}

/**
 * Detailed analysis results
 */
export class AnalysisDto {
  language: string;
  lang_certainity: number;
  cached: boolean;
  processing_time_ms: number;
  risk_level: number;
  triggers: string[];
  enhanced: EnhancedAnalysisDto;
}

/**
 * Response DTO for /analyze endpoint
 * Contains analysis results and metadata
 */
export class AnalyzeResponseDto {
  status: string;
  certainity: number;
  message: string;
  customer_whitelisted: boolean;
  analysis: AnalysisDto;
}
