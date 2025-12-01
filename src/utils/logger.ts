/**
 * Advanced Logging System for AGI Framework
 * Supports multiple log levels, structured logging, and performance tracking
 */

import winston from 'winston';
import path from 'path';

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string = 'AGI') {
    this.context = context;
    this.setupLogger();
  }

  private setupLogger(): void {
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const logEntry = {
          timestamp,
          level,
          context: context || this.context,
          message,
          ...meta
        };
        return JSON.stringify(logEntry, null, 0);
      })
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss.SSS'
      }),
      winston.format.printf(({ timestamp, level, message, context }) => {
        return `${timestamp} [${context || this.context}] ${level}: ${message}`;
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      transports: [
        // Console transport with colorized output
        new winston.transports.Console({
          format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat
        }),
        
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'agi-framework.log'),
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        }),

        // Error-only file transport
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ],
      
      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'exceptions.log')
        })
      ],
      
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'rejections.log')
        })
      ]
    });
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { context: this.context, ...context });
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, { context: this.context, ...context });
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { context: this.context, ...context });
  }

  public error(message: string, error?: Error | any, context?: LogContext): void {
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error;

    this.logger.error(message, {
      context: this.context,
      error: errorInfo,
      ...context
    });
  }

  public performance(operation: string, duration: number, context?: LogContext): void {
    this.logger.info(`Performance: ${operation}`, {
      context: this.context,
      operation,
      duration_ms: duration,
      performance: true,
      ...context
    });
  }

  public audit(action: string, details: any, context?: LogContext): void {
    this.logger.info(`Audit: ${action}`, {
      context: this.context,
      audit: true,
      action,
      details,
      ...context
    });
  }

  public security(event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    this.logger.warn(`Security: ${event}`, {
      context: this.context,
      security: true,
      event,
      severity,
      details,
      timestamp: new Date().toISOString()
    });
  }

  public createChildLogger(childContext: string): Logger {
    const childLogger = new Logger(`${this.context}:${childContext}`);
    return childLogger;
  }

  public static async measureTime<T>(
    operation: string,
    fn: () => Promise<T>,
    logger?: Logger
  ): Promise<{ result: T; duration: number }> {
    const start = process.hrtime.bigint();
    
    try {
      const result = await fn();
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      if (logger) {
        logger.performance(operation, duration);
      }

      return { result, duration };
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;

      if (logger) {
        logger.error(`Performance: ${operation} failed`, error, { duration_ms: duration });
      }

      throw error;
    }
  }

  public static createStructuredLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data: Record<string, any>
  ): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data
    };
  }
}