import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorMessage = string | string[];

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message: ErrorMessage = 'An unexpected error occurred';

    if (this.isDuplicateKeyError(exception)) {
      statusCode = HttpStatus.CONFLICT;
      error = 'Conflict';
      message = 'A record with the same unique value already exists';
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      error = exception.name;

      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const responseBody = exceptionResponse as Record<string, unknown>;

        if (this.isErrorMessage(responseBody.message)) {
          message = responseBody.message;
        }

        if (typeof responseBody.error === 'string') {
          error = responseBody.error;
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }

  private isDuplicateKeyError(value: unknown): value is { code: 11000 } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      value.code === 11000
    );
  }

  private isErrorMessage(value: unknown): value is ErrorMessage {
    return (
      typeof value === 'string' ||
      (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    );
  }
}
