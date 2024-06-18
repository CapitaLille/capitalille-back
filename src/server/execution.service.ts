import { Injectable } from '@nestjs/common';

interface QueueItem {
  resolve: Function;
  reject: Function;
}

@Injectable()
export class ExecutionManagementService {
  private executionQueues: { [playerId: string]: QueueItem[] } = {};

  addToQueue(playerId: string, resolve: Function, reject: Function) {
    if (!this.executionQueues[playerId]) {
      this.executionQueues[playerId] = [];
    }
    console.log(
      'Add to queue',
      playerId,
      this.executionQueues[playerId].length,
    );
    this.executionQueues[playerId].push({ resolve, reject });
  }

  dequeue(playerId: string): QueueItem | undefined {
    if (
      !this.executionQueues[playerId] ||
      this.executionQueues[playerId].length === 0
    ) {
      return undefined;
    }
    console.log('Dequeue', playerId, this.executionQueues[playerId].length);
    return this.executionQueues[playerId].shift();
  }

  private executingPlayers: { [playerId: string]: boolean } = {};

  setIsExecuting(playerId: string, value: boolean) {
    this.executingPlayers[playerId] = value;
  }

  isExecuting(playerId: string): boolean {
    return this.executingPlayers[playerId] || false;
  }
}
