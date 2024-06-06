import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type PlayerDocument = HydratedDocument<Player>;

@Schema()
export class Player {
  @Prop({ required: true })
  user: string;
  @Prop({ required: true })
  lobby: string;
  @Prop({ required: false, default: [] })
  houses: number[];
  @Prop({ required: false, default: 0 })
  money: number;
  @Prop({ required: false, default: 2.5, min: 0, max: 5 })
  rating: number;
  @Prop({ required: false, default: 0 })
  casePosition: number;
  @Prop({ required: false, default: [] })
  bonuses: playerVaultType[];
  @Prop({ required: false, default: [] })
  transactions: Transaction[];
  @Prop({ required: false, default: false })
  turnPlayed: boolean;
  @Prop({ required: false, default: false })
  actionPlayed: boolean;
  @Prop({ required: false, default: false })
  lost: boolean;
}

export enum PlayerEvent {
  JOIN_LOBBY = 'joinLobby',
  START_GAME = 'startGame',
  PLAY_TURN = 'playTurn',
  SUBSCRIBE = 'subscribe',
  BUY_AUCTION = 'auction',
  BANK_LOAN_TAKE = 'bankLoanRequest',
  HOUSE_RENT_FRAUD = 'houseRent',
  HOUSE_RENT_PAY = 'houseRentPay',
  UNHANDLED_EVENT = 'unhandledEvent',
  METRO_PAY = 'metroRequest',
  BUS_PAY = 'busRequest',
  MONUMENTS_PAY = 'monumentsRequest',
  COPS_COMPLAINT = 'copsRequest',
  SCHOOL_PAY = 'schoolRequest',
  CASINO_GAMBLE = 'casinoRequest',
}

@Schema()
export class Transaction {
  @Prop({ required: true })
  amount: number;
  @Prop({ required: true })
  playerId: string; // Could be the bank.
  @Prop({ required: true })
  type: moneyTransactionType | ratingTransactionType;
}

export enum moneyTransactionType {
  RENT = 'rent',
  RENT_FINED = 'rent_fined',
  RENT_FRAUD = 'rent_fraud',
  BUY = 'buy',
  SELL = 'sell',
  LOAN = 'loan',
  LOAN_REPAY = 'loan_repay',
  BUS = 'bus',
  METRO = 'metro',
  SCHOOL = 'school',
  CASINO = 'casino',
  SALARY = 'salary',
  ACTION = 'action',
  AUCTION = 'auction',
  HOUSE_TRANSACTION = 'house_transaction',
  MONUMENTS_PAY = 'monuments_pay',
}

export enum ratingTransactionType {
  MONUMENTS_RATING = 'monuments_rating',
  COPS_RATING = 'cops_rating',
}

export enum playerVaultType {
  diceDouble,
  diceDividedBy2,
  dicePlus2,
  diceMinus2,
  forward3,
  backward3,
  loan,
  diploma,
  rentDiscount,
  casino_temp,
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
