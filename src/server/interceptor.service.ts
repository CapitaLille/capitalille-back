import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
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
    console.log('Intercept', playerId);
    return new Observable((observer) => {
      const queueItem = {
        resolve: () => {
          this.executionService.setIsExecuting(playerId, false);
          observer.next(undefined);
          observer.complete();
        },
        reject: (error: Error) => {
          this.executionService.setIsExecuting(playerId, false);
          observer.error(error);
        },
      };

      if (this.executionService.isExecuting(playerId)) {
        this.executionService.addToQueue(
          playerId,
          queueItem.resolve,
          queueItem.reject,
        );
      } else {
        this.executionService.setIsExecuting(playerId, true);
        observer.next(undefined);
        observer.complete();
      }
    }).pipe(
      switchMap(() => {
        return next.handle().pipe(
          tap(() => {
            const queueItem = this.executionService.dequeue(playerId);
            if (queueItem) {
              queueItem.resolve();
            } else {
              this.executionService.setIsExecuting(playerId, false);
            }
          }),
        );
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
  }
}
