import { LoggingInterceptor } from '../logging.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Request, Response } from 'express';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();

    mockRequest = {
      method: 'POST',
      url: '/analyze',
      body: {
        parentID: '123e4567-e89b-12d3-a456-426614174000',
        customerID: '223e4567-e89b-12d3-a456-426614174001',
        senderID: 'test@example.com',
        messageID: '323e4567-e89b-12d3-a456-426614174002',
        content: 'This is test content',
      },
    };

    mockResponse = {
      statusCode: 200,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should log incoming request without content field', (done) => {
    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(
        of({
          analysis: {
            language: 'eng',
            cached: false,
          },
        }),
      ),
    };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: () => {
        // Check that incoming request was logged
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Incoming request',
            method: 'POST',
            url: '/analyze',
            parentID: '123e4567-e89b-12d3-a456-426614174000',
            customerID: '223e4567-e89b-12d3-a456-426614174001',
            senderID: 'test@example.com',
            messageID: '323e4567-e89b-12d3-a456-426614174002',
          }),
        );

        // Verify content field is not logged
        const firstCall = logSpy.mock.calls[0][0];
        expect(firstCall).not.toHaveProperty('content');

        logSpy.mockRestore();
        done();
      },
    });
  });

  it('should log completed request with response metadata', (done) => {
    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(
        of({
          analysis: {
            language: 'eng',
            cached: false,
          },
        }),
      ),
    };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: () => {
        // Check that completion was logged (second call)
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Request completed',
            method: 'POST',
            url: '/analyze',
            statusCode: 200,
            cached: false,
            language: 'eng',
          }),
        );

        logSpy.mockRestore();
        done();
      },
    });
  });

  it('should log cached status when response is cached', (done) => {
    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(
        of({
          analysis: {
            language: 'fra',
            cached: true,
          },
        }),
      ),
    };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            cached: true,
            language: 'fra',
          }),
        );

        logSpy.mockRestore();
        done();
      },
    });
  });

  it('should log errors with validation details', (done) => {
    const errorSpy = jest.spyOn(interceptor['logger'], 'error');
    const testError = {
      status: 400,
      message: 'Validation failed',
      response: {
        message: ['content must be shorter than 2000 characters'],
      },
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(throwError(() => testError)),
    };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      error: (error) => {
        expect(error).toBe(testError);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Request failed',
            method: 'POST',
            url: '/analyze',
            statusCode: 400,
            error: 'Validation failed',
            validationErrors: ['content must be shorter than 2000 characters'],
          }),
        );

        errorSpy.mockRestore();
        done();
      },
    });
  });

  it('should default to 500 status code for errors without status', (done) => {
    const errorSpy = jest.spyOn(interceptor['logger'], 'error');
    const testError = {
      message: 'Internal error',
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(throwError(() => testError)),
    };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      error: () => {
        expect(errorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            error: 'Internal error',
          }),
        );

        errorSpy.mockRestore();
        done();
      },
    });
  });

  it('should handle request body without content field', (done) => {
    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    mockRequest.body = {
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '223e4567-e89b-12d3-a456-426614174001',
    };

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    };

    const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

    result$.subscribe({
      next: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Incoming request',
            parentID: '123e4567-e89b-12d3-a456-426614174000',
          }),
        );

        logSpy.mockRestore();
        done();
      },
    });
  });
});
