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
  INFO = 'info',
  UNSUBSCRIBE = 'unsubscribe',
  UPGRADE_HOUSE = 'upgradeHouse',
  START_GAME = 'startGame',
  PLAY_TURN = 'playTurn', // Return player's diceBonuses, path, salary and last case gameEvent.
  PLAYER_UPDATE = 'playerUpdate',
  LOBBY_UPDATE = 'lobbyUpdate',
  NEW_PLAYER = 'newPlayer',
  MONEY_CHANGE = 'moneyChange',
  LOST_GAME = 'lostGame',
  NEXT_TURN = 'nextTurn',
  END_GAME = 'endGame',
  BANK_LOAN_REQUEST = 'bankLoanRequest', // Request a choise (a loan to the bank or pass)
  BANK_LOAN_REFUND = 'bankLoanRefund', // Refund a loan to the bank.
  HOUSE_RENT_REQUEST = 'houseRent', // Propose to fraud a player or pay rent.
  HOUSE_UPDATE = 'houseUpdate', // A change occured on a house.
  HOUSE_RENT_PAY = 'houseRentPay', // Pay rent to another player.
  UNHANDLED_EVENT = 'unhandledEvent',
  METRO_REQUEST = 'metroRequest', // Request to take the metro or pass.
  BUS_REQUEST = 'busRequest', // Request to take the bus or pass.
  MONUMENTS_REQUEST = 'monumentsRequest', // Request to visit the monuments or pass.
  COPS_REQUEST = 'copsRequest', // Request to pay the cops or pass.
  SCHOOL_REQUEST = 'schoolRequest', // Request to pay the school or pass.
  NEW_MESSAGE = 'newMessage',
  MESSAGE_SENT = 'messageSent',
  MESSAGE_ERROR = 'messageError',
  GET_CONVERSATIONS = 'getConversations',
}

export interface PlayerSocketId {
  playerId: string;
  socketId: string;
}

export interface InfoSocket {
  icon: string;
  message: string;
  title: string;
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

export const PRICE = (price: number, extend: boolean = false): string => {
  if (price === undefined || price === null) return '~~';
  if (price < 0) {
    return '-' + PRICE(-price, extend);
  }
  if (!extend) {
    if (price >= 1000000) {
      // 300 000 000 to 300.0M, 1 200 000 to 1.2M, 294 000 000 to 294.0M
      return (price / 1000000).toFixed(1) + 'M';
    }
    if (price >= 1000) {
      // 100 000 to 100K, 1200 to 1.2K, 294 000 to 294K not 294.0K
      if (price % 1000 === 0) {
        return (price / 1000).toFixed(0) + 'K';
      }
      return (price / 1000).toFixed(1) + 'K';
    } else {
      return price.toString();
    }
  } else {
    if (price >= 1000000) {
      // 1200000 to 1,200,000
      return price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    //100000 to 100,000
    return price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
};
