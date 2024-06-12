import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { ExecutionManagementService } from './execution.service';
import { GameEvent } from './server.type';

@Injectable()
export class ExecutionInterceptor implements NestInterceptor {
  constructor(private readonly executionService: ExecutionManagementService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const socket = context.switchToWs().getClient();
    const playerId = socket?.handshake?.user?.sub;
    console.log('Before Interceptor: ' + playerId);

    return new Observable((observer) => {
      const queueItem = {
        resolve: () => {
          observer.next(undefined);
          observer.complete();
        },
        reject: (error: Error) => {
          observer.error(error);
        },
      };

      if (this.executionService.isExecuting(playerId)) {
        console.log('Adding to queue ' + playerId);
        this.executionService.addToQueue(
          playerId,
          queueItem.resolve,
          queueItem.reject,
        );
      } else {
        console.log('Executing ' + playerId);
        this.executionService.setIsExecuting(playerId, true);
        observer.next(undefined);
        observer.complete();
      }
    }).pipe(
      switchMap(() => {
        return next.handle().pipe(
          tap(() => {
            const queueItem = this.executionService.dequeue(playerId);
            console.log('After execution ' + playerId);
            if (queueItem) {
              console.log('Resolving last queue ' + playerId);
              queueItem.resolve();
            } else {
              this.executionService.setIsExecuting(playerId, false);
            }
          }),
          catchError((error) => {
            const queueItem = this.executionService.dequeue(playerId);
            if (queueItem) {
              queueItem.reject(error);
            } else {
              this.executionService.setIsExecuting(playerId, false);
            }
            socket.emit(GameEvent.ERROR, { message: error.message });
            return throwError(() => new Error(error.message));
          }),
        );
      }),
    );
  }
}
