import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Create Winston logger instance with environment-specific configuration
 */
export function createWinstonLogger(
  nodeEnv: string,
  logLevel: string,
  logFilePath: string,
): winston.Logger {
  const isDevelopment = nodeEnv === 'development';

  const transports: winston.transport[] = [];

  if (isDevelopment) {
    // Development: Console with pretty formatting
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            let msg = `[${timestamp}] [${level}]`;
            if (context) {
              msg += ` [${context}]`;
            }
            msg += `: ${typeof message === 'object' ? JSON.stringify(message) : message}`;
            if (Object.keys(meta).length > 0) {
              msg += ` ${JSON.stringify(meta)}`;
            }
            return msg;
          }),
        ),
      }),
    );
  } else {
    // Production: JSON format to file with daily rotation
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    // Daily rotate file for all logs
    transports.push(
      new DailyRotateFile({
        filename: `${logFilePath}/application-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
      }),
    );

    // Separate file for errors
    transports.push(
      new DailyRotateFile({
        filename: `${logFilePath}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level: 'error',
        format: fileFormat,
      }),
    );

    // Also log to console in JSON format for container logging
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json(),
        ),
      }),
    );
  }

  return winston.createLogger({
    level: logLevel,
    transports,
    exitOnError: false,
  });
}
