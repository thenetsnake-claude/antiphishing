import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interceptor to log all requests and responses
 * Logs everything except the content field for privacy
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body } = request;
    const startTime = Date.now();

    // Log request (without content field)
    const logBody = { ...body };
    if (logBody.content) {
      delete logBody.content;
    }

    this.logger.log({
      message: 'Incoming request',
      method,
      url,
      ...logBody,
    });

    return next.handle().pipe(
      tap((responseBody) => {
        const processingTime = Date.now() - startTime;
        this.logger.log({
          message: 'Request completed',
          method,
          url,
          statusCode: response.statusCode,
          processingTime,
          cached: responseBody?.analysis?.cached,
          language: responseBody?.analysis?.language,
        });
      }),
      catchError((error) => {
        const processingTime = Date.now() - startTime;
        this.logger.error({
          message: 'Request failed',
          method,
          url,
          statusCode: error.status || 500,
          processingTime,
          error: error.message,
        });
        throw error;
      }),
    );
  }
}
