import e from 'express';

export class GameError<T> {
  event: string;
  data: T;

  constructor(message: string = 'Error', data: T = null) {
    // this.message = message;
    this.event = 'error';
    this.data = { message, ...data };
  }
}

export class GameResponse<T> {
  event: string;
  data: T;

  constructor(event: string, data: T, message: string = 'Success') {
    this.data = { message, ...data };
    this.event = event;
  }
}

export enum GameEvent {
  ERROR = 'error',
  GET_PARTY = 'getParty',
  PLAY_TURN = 'playTurn',
  TRY = 'try',
}

export interface PlayerSocketId {
  playerId: string;
  socketId: string;
}
