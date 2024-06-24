import e from 'express';
import mongoose from 'mongoose';
import { CreateLobbyDto } from 'src/lobby/dto/create-lobby.dto';
import { Configuration } from 'src/map/map.schema';
import {
  moneyTransactionType,
  ratingTransactionType,
} from 'src/player/player.schema';

export enum GameEvent {
  ERROR = 'error',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  SELL_HOUSE = 'sellHouse',
  UPGRADE_HOUSE = 'upgradeHouse',
  START_GAME = 'startGame',
  PLAY_TURN = 'playTurn', // Return player's diceBonuses, path, salary and last case gameEvent.
  PLAYER_UPDATE = 'playerUpdate',
  LOBBY_UPDATE = 'lobbyUpdate',
  NEW_PLAYER = 'newPlayer',
  MONEY_CHANGE = 'moneyChange',
  HOUSE_REPAIR = 'houseRepair',
  RATING_CHANGE = 'ratingChange',
  AUCTION_SET = 'auctionSet',
  AUCTION_EXIT = 'auctionExit',
  LOST_GAME = 'lostGame',
  NEXT_TURN = 'nextTurn',
  END_GAME = 'endGame',
  CASINO_LOST = 'casinoLost',
  CASINO_WIN = 'casinoWin',
  NOT_ENOUGH_MONEY = 'notEnoughMoney',
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
  MONUMENTS_PAID = 'monumentsPaid', // Monuments visited. Pay the monuments.
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
  type: moneyTransactionType;

  constructor(
    from: string,
    to: string,
    amount: number,
    type: moneyTransactionType,
  ) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.type = type;
  }
}

export class RatingChangeData {
  from: string | 'bank';
  to: string | 'bank';
  amount: number;
  type: ratingTransactionType;

  constructor(
    from: string,
    to: string,
    amount: number,
    type: ratingTransactionType,
  ) {
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

export const publicServer = {
  limit: 3,
  turnSchedule: [120, 240, 2 * 3600, 4 * 3600, 6 * 3600, 12 * 3600, 24 * 3600],
  turnCountMax: [30, 30, 60, 90, 90, 90, 90],
};
