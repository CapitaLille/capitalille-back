import e from 'express';
import mongoose from 'mongoose';
import { transactionType } from 'src/player/player.schema';

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
  MONEY_CHANGE = 'moneyChange',
  AUCTION = 'auction',
  LOSE_AUCTION = 'loseAuction',
}

export interface PlayerSocketId {
  playerId: string;
  socketId: string;
}

export class MoneyChangeData {
  from: string | 'bank';
  to: string | 'bank';
  amount: number;
  type: transactionType;

  constructor(from: string, to: string, amount: number, type: transactionType) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.type = type;
  }
}

export class AuctionData {
  houseIndex: number;
  playerId: string;
  newAuction: number;
  constructor(houseIndex: number, playerId: string, newAuction: number) {
    this.houseIndex = houseIndex;
    this.playerId = playerId;
    this.newAuction = newAuction;
  }
}

export class Bank {
  static id = 'bank';
}

export type Doc<T> = mongoose.Document<unknown, {}, T> &
  T & {
    _id: mongoose.Types.ObjectId;
  };
