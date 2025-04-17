import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  
  @Injectable()
  export class ResponseInterceptor implements NestInterceptor {
    intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
      return next.handle().pipe(
        map((data) => {
          if (data === undefined || data === null) {
            return {
              statusCode: 204,
              message: '성공',
            };
          }
  
          return {
            statusCode: 200,
            message: '성공',
            data,
          };
        }),
      );
    }
  }
  