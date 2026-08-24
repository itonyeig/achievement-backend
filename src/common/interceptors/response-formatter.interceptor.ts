import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  statusCode?: number;
  message: string;
  data?: T;
};

export class ResponseFormatter {
  static ok<T>(
    options: {
      statusCode?: number;
      data?: T;
      message?: string;
    } = {},
  ): ApiSuccessResponse<T> {
    const response: ApiSuccessResponse<T> = {
      success: true,
      message: options.message ?? 'Request was successful',
    };

    if (options.statusCode !== undefined) {
      response.statusCode = options.statusCode;
    }

    if (options.data !== undefined) {
      response.data = options.data;
    }

    return response;
  }
}

@Injectable()
export class ResponseFormatterInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (this.isFormattedResponse(data)) {
          return {
            ...data,
            statusCode: data.statusCode ?? response.statusCode,
          };
        }

        if (typeof data === 'string') {
          return ResponseFormatter.ok({
            statusCode: response.statusCode,
            message: data,
          });
        }

        return ResponseFormatter.ok({
          statusCode: response.statusCode,
          data,
        });
      }),
    );
  }

  private isFormattedResponse(value: unknown): value is ApiSuccessResponse<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      value.success === true &&
      'message' in value &&
      typeof value.message === 'string'
    );
  }
}
