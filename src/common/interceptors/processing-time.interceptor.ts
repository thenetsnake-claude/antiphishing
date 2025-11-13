import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Interceptor to track and add processing time to response headers
 * Adds X-Processing-Time header with processing time in milliseconds
 */
@Injectable()
export class ProcessingTimeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProcessingTimeInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const processingTime = Date.now() - startTime;
        response.setHeader('X-Processing-Time', processingTime.toString());
        this.logger.debug(`Request processed in ${processingTime}ms`);
      }),
    );
  }
}
