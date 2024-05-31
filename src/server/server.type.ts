import e from 'express';
import mongoose from 'mongoose';
import { transactionType } from 'src/player/player.schema';

export class GameError<T> {
  event: string;
  data: T;

  constructor(message: string = 'Error', data: T = null) {
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
  SUBSCRIBE = 'subscribe',
  PLAY_TURN = 'playTurn', // Return player's diceBonuses, path, salary and last case gameEvent.
  PLAYER_UPDATE = 'playerUpdate',
  MONEY_CHANGE = 'moneyChange',
  AUCTION_SET = 'auctionSet',
  AUCTION_EXIT = 'auctionExit',
  LOST_GAME = 'lostGame',
  NEXT_TURN = 'nextTurn',
  END_GAME = 'endGame',
  BANK_LOAN_REQUEST = 'bankLoanRequest', // Request a choise (a loan to the bank or pass)
  BANK_LOAN_REFUND = 'bankLoanRefund', // Refund a loan to the bank.
  HOUSE_RENT_REQUEST = 'houseRent', // Propose to fraud a player or pay rent.
  HOUSE_UPDATE = 'houseUpdate', // A change occured on a house.
  HOUSE_RENT_PAY = 'houseRentPay', // Pay rent to another player.
  HOUSE_RENT_FRAUD_SUCCESS = 'houseRentFraudSuccess', // Fraud succeeded. Pay nothing.
  HOUSE_RENT_FRAUD_FAIL = 'houseRentFraudFail', // Fraud failed. Pay rent * x + Reputation loss.
  UNHANDLED_EVENT = 'unhandledEvent',
  METRO_REQUEST = 'metroRequest', // Request to take the metro or pass.
  BUS_REQUEST = 'busRequest', // Request to take the bus or pass.
  MONUMENTS_REQUEST = 'monumentsRequest', // Request to visit the monuments or pass.
  COPS_REQUEST = 'copsRequest', // Request to pay the cops or pass.
  SCHOOL_REQUEST = 'schoolRequest', // Request to pay the school or pass.
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
