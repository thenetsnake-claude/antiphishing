import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Antiphishing API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /analyze', () => {
    const validRequest = {
      parentID: '123e4567-e89b-12d3-a456-426614174000',
      customerID: '123e4567-e89b-12d3-a456-426614174001',
      senderID: 'test@example.com',
      content: 'This is a test message in English',
      messageID: '123e4567-e89b-12d3-a456-426614174002',
    };

    it('should analyze content successfully', () => {
      return request(app.getHttpServer())
        .post('/analyze')
        .send(validRequest)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'safe');
          expect(res.body).toHaveProperty('certainity', 0);
          expect(res.body).toHaveProperty('message', 'no analysis');
          expect(res.body).toHaveProperty('customer_whitelisted', false);
          expect(res.body).toHaveProperty('analysis');
          expect(res.body.analysis).toHaveProperty('language');
          expect(res.body.analysis).toHaveProperty('lang_certainity');
          expect(res.body.analysis).toHaveProperty('cached');
          expect(res.body.analysis).toHaveProperty('processing_time_ms');
          expect(res.body.analysis).toHaveProperty('risk_level', 0);
          expect(res.body.analysis).toHaveProperty('triggers');
          expect(res.body.analysis).toHaveProperty('enhanced');
          expect(res.headers).toHaveProperty('x-processing-time');
        });
    });

    it('should detect English language', () => {
      return request(app.getHttpServer())
        .post('/analyze')
        .send({
          ...validRequest,
          content: 'Hello, this is a test message in English language',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.analysis.language).toBe('eng');
          expect(res.body.analysis.lang_certainity).toBeGreaterThan(0);
        });
    });

    it('should detect French language', () => {
      return request(app.getHttpServer())
        .post('/analyze')
        .send({
          ...validRequest,
          content: 'Bonjour, ceci est un message de test en français',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.analysis.language).toBe('fra');
          expect(res.body.analysis.lang_certainity).toBeGreaterThan(0);
        });
    });

    it('should include X-Processing-Time header', () => {
      return request(app.getHttpServer())
        .post('/analyze')
        .send(validRequest)
        .expect(200)
        .expect((res) => {
          expect(res.headers['x-processing-time']).toBeDefined();
          const processingTime = parseInt(res.headers['x-processing-time']);
          expect(processingTime).toBeGreaterThan(0);
        });
    });

    it('should cache results', async () => {
      const uniqueContent = {
        ...validRequest,
        content: `Unique content for caching test ${Date.now()}`,
      };

      // First request - should not be cached
      const firstResponse = await request(app.getHttpServer())
        .post('/analyze')
        .send(uniqueContent)
        .expect(200);

      expect(firstResponse.body.analysis.cached).toBe(false);

      // Second request with same content - should be cached
      const secondResponse = await request(app.getHttpServer())
        .post('/analyze')
        .send(uniqueContent)
        .expect(200);

      expect(secondResponse.body.analysis.cached).toBe(true);
    });

    describe('Validation', () => {
      it('should return 400 for missing parentID', () => {
        const invalidRequest = { ...validRequest };
        delete invalidRequest.parentID;

        return request(app.getHttpServer())
          .post('/analyze')
          .send(invalidRequest)
          .expect(400)
          .expect((res) => {
            expect(res.body.statusCode).toBe(400);
            expect(res.body.message).toBeInstanceOf(Array);
          });
      });

      it('should return 400 for invalid parentID UUID', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            parentID: 'invalid-uuid',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([expect.stringContaining('parentID')]),
            );
          });
      });

      it('should return 400 for missing customerID', () => {
        const invalidRequest = { ...validRequest };
        delete invalidRequest.customerID;

        return request(app.getHttpServer()).post('/analyze').send(invalidRequest).expect(400);
      });

      it('should return 400 for invalid customerID UUID', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            customerID: 'not-a-uuid',
          })
          .expect(400);
      });

      it('should return 400 for missing senderID', () => {
        const invalidRequest = { ...validRequest };
        delete invalidRequest.senderID;

        return request(app.getHttpServer()).post('/analyze').send(invalidRequest).expect(400);
      });

      it('should return 400 for empty senderID', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            senderID: '',
          })
          .expect(400);
      });

      it('should return 400 for missing content', () => {
        const invalidRequest = { ...validRequest };
        delete invalidRequest.content;

        return request(app.getHttpServer()).post('/analyze').send(invalidRequest).expect(400);
      });

      it('should return 400 for empty content', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: '',
          })
          .expect(400);
      });

      it('should return 400 for content exceeding 2000 characters', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'a'.repeat(2001),
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toEqual(
              expect.arrayContaining([expect.stringContaining('2000 characters')]),
            );
          });
      });

      it('should accept content with exactly 2000 characters', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'a'.repeat(2000),
          })
          .expect(200);
      });

      it('should return 400 for missing messageID', () => {
        const invalidRequest = { ...validRequest };
        delete invalidRequest.messageID;

        return request(app.getHttpServer()).post('/analyze').send(invalidRequest).expect(400);
      });

      it('should return 400 for invalid messageID UUID', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            messageID: '12345',
          })
          .expect(400);
      });

      it('should return 400 for multiple validation errors', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            parentID: 'invalid',
            customerID: 'invalid',
            senderID: '',
            content: '',
            messageID: 'invalid',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message.length).toBeGreaterThan(1);
          });
      });
    });
  });

  describe('GET /health', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
        });
    });
  });

  describe('GET /health/readiness', () => {
    it('should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/health/readiness')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ status: 'ok' });
        });
    });
  });

  describe('GET /health/liveness', () => {
    it('should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/health/liveness')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ status: 'ok' });
        });
    });
  });
});
