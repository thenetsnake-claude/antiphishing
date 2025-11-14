import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
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

    describe('URL Detection', () => {
      it('should detect http URLs in content', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Visit http://example.com for more information',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toContain('http://example.com');
            expect(res.body.analysis.enhanced.urls).toHaveLength(1);
          });
      });

      it('should detect https URLs in content', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Secure site at https://secure.example.com',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toContain('https://secure.example.com');
            expect(res.body.analysis.enhanced.urls).toHaveLength(1);
          });
      });

      it('should detect www URLs and add protocol', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Check out www.example.org',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toContain('http://www.example.org');
            expect(res.body.analysis.enhanced.urls).toHaveLength(1);
          });
      });

      it('should detect multiple URLs', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Visit https://example.com or http://test.org and www.sample.net today',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toHaveLength(3);
            expect(res.body.analysis.enhanced.urls).toContain('https://example.com');
            expect(res.body.analysis.enhanced.urls).toContain('http://test.org');
            expect(res.body.analysis.enhanced.urls).toContain('http://www.sample.net');
          });
      });

      it('should handle URLs with paths and parameters', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Click https://example.com/path/to/page?param=value&id=123',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toContain(
              'https://example.com/path/to/page?param=value&id=123',
            );
          });
      });

      it('should return empty array when no URLs present', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'This is a message without any URLs at all',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toEqual([]);
          });
      });

      it('should deduplicate identical URLs', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Visit https://example.com and also https://example.com for more information',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toHaveLength(1);
            expect(res.body.analysis.enhanced.urls).toContain('https://example.com');
          });
      });

      it('should detect bare domains without protocol', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Visit example.com for more information',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toContain('http://example.com');
            expect(res.body.analysis.enhanced.urls).toHaveLength(1);
          });
      });

      it('should detect multiple bare domains', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Visit example.com, test.org, and demo.net today',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toHaveLength(3);
            expect(res.body.analysis.enhanced.urls).toContain('http://example.com');
            expect(res.body.analysis.enhanced.urls).toContain('http://test.org');
            expect(res.body.analysis.enhanced.urls).toContain('http://demo.net');
          });
      });

      it('should not detect email addresses as URLs', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Contact us at support@example.com for help',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toEqual([]);
          });
      });

      it('should handle mixed protocol and bare domains', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Visit https://secure.com, example.org, and www.test.net',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.urls).toHaveLength(3);
            expect(res.body.analysis.enhanced.urls).toContain('https://secure.com');
            expect(res.body.analysis.enhanced.urls).toContain('http://example.org');
            expect(res.body.analysis.enhanced.urls).toContain('http://www.test.net');
          });
      });
    });

    describe('Phone Number Detection', () => {
      it('should detect international phone numbers', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Call us at +1-202-456-1111 for support',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
            if (res.body.analysis.enhanced.phones.length > 0) {
              expect(res.body.analysis.enhanced.phones[0]).toContain('1202');
            }
          });
      });

      it('should detect phone numbers with dots', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Contact: +1.202.456.1111',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
          });
      });

      it('should detect multiple phone numbers', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Call +1-202-456-1111 or +44-20-7946-0958',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
          });
      });

      it('should return empty array when no phones present', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'This message has no phone numbers at all',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones).toEqual([]);
          });
      });

      it('should detect Belgian local toll-free numbers', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Call our helpline at 0800 33 800',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
            if (res.body.analysis.enhanced.phones.length > 0) {
              expect(res.body.analysis.enhanced.phones[0]).toMatch(/\+32800/);
            }
          });
      });

      it('should detect Belgian local landline numbers', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Our office number is 02 123 45 67',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
            if (res.body.analysis.enhanced.phones.length > 0) {
              expect(res.body.analysis.enhanced.phones[0]).toMatch(/\+322/);
            }
          });
      });

      it('should detect Belgian mobile numbers', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'My mobile is 0470 12 34 56',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.phones.length).toBeGreaterThanOrEqual(1);
            if (res.body.analysis.enhanced.phones.length > 0) {
              expect(res.body.analysis.enhanced.phones[0]).toMatch(/\+3247/);
            }
          });
      });
    });

    describe('Public IP Detection', () => {
      it('should detect public IPv4 addresses', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Server IP is 8.8.8.8 for DNS',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.public_ips).toContain('8.8.8.8');
          });
      });

      it('should detect multiple public IPs', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'DNS servers: 8.8.8.8 and 1.1.1.1',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.public_ips).toContain('8.8.8.8');
            expect(res.body.analysis.enhanced.public_ips).toContain('1.1.1.1');
            expect(res.body.analysis.enhanced.public_ips.length).toBe(2);
          });
      });

      it('should filter out private IP addresses', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'Private: 192.168.1.1, Public: 8.8.8.8',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.public_ips).toContain('8.8.8.8');
            expect(res.body.analysis.enhanced.public_ips).not.toContain('192.168.1.1');
            expect(res.body.analysis.enhanced.public_ips.length).toBe(1);
          });
      });

      it('should return empty array when no IPs present', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'No IP addresses in this message',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.public_ips).toEqual([]);
          });
      });

      it('should detect IPv6 addresses', () => {
        return request(app.getHttpServer())
          .post('/analyze')
          .send({
            ...validRequest,
            content: 'IPv6 server: 2001:4860:4860::8888',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.analysis.enhanced.public_ips.length).toBeGreaterThanOrEqual(1);
            if (res.body.analysis.enhanced.public_ips.length > 0) {
              expect(res.body.analysis.enhanced.public_ips[0]).toMatch(/2001:4860:4860/);
            }
          });
      });
    });

    describe('Validation', () => {
      it('should return 400 for missing parentID', () => {
        const invalidRequest = { ...validRequest } as Record<string, unknown>;
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
        const invalidRequest = { ...validRequest } as Record<string, unknown>;
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
        const invalidRequest = { ...validRequest } as Record<string, unknown>;
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
        const invalidRequest = { ...validRequest } as Record<string, unknown>;
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
        const invalidRequest = { ...validRequest } as Record<string, unknown>;
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
