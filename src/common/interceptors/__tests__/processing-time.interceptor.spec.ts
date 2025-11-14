import { ProcessingTimeInterceptor } from '../processing-time.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Response } from 'express';

describe('ProcessingTimeInterceptor', () => {
  let interceptor: ProcessingTimeInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    interceptor = new ProcessingTimeInterceptor();

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    };
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should add X-Processing-Time header to response', (done) => {
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: (data) => {
        expect(data).toEqual({ data: 'test' });
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'X-Processing-Time',
          expect.any(String),
        );
        done();
      },
    });
  });

  it('should calculate processing time correctly', (done) => {
    const startTime = Date.now();
    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: () => {
        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'X-Processing-Time',
          expect.stringMatching(/^\d+$/),
        );

        const capturedTime = parseInt((mockResponse.setHeader as jest.Mock).mock.calls[0][1], 10);
        expect(capturedTime).toBeGreaterThanOrEqual(0);
        expect(capturedTime).toBeLessThanOrEqual(processingTime + 10); // Allow small margin
        done();
      },
    });
  });

  it('should call next.handle()', () => {
    interceptor.intercept(mockExecutionContext, mockCallHandler);
    expect(mockCallHandler.handle).toHaveBeenCalled();
  });
});
