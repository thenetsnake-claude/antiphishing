import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createWinstonLogger } from './common/logger/winston.logger';
import { WinstonModule } from 'nest-winston';

async function bootstrap() {
  // Create temporary logger for bootstrap
  const bootstrapLogger = new Logger('Bootstrap');

  // Create app
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get config service
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv');
  const port = configService.get<number>('port');
  const logLevel = configService.get<string>('logging.level');
  const logFilePath = configService.get<string>('logging.filePath');

  // Create and set Winston logger
  const winstonLogger = createWinstonLogger(nodeEnv, logLevel, logFilePath);
  app.useLogger(WinstonModule.createLogger({ instance: winstonLogger }));

  // Enable global validation pipe
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

  // Start listening
  await app.listen(port);

  bootstrapLogger.log(`Application is running on: http://localhost:${port}`);
  bootstrapLogger.log(`Environment: ${nodeEnv}`);
  bootstrapLogger.log(`Log level: ${logLevel}`);
}

bootstrap();
