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
  @Prop({ required: false, default: 2.5 })
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
}

@Schema()
export class Transaction {
  @Prop({ required: true })
  amount: number;
  @Prop({ required: true })
  from: string;
  @Prop({ required: true })
  to: string;
  @Prop({ required: true })
  type: string;
}

export enum playerVaultType {
  diceDouble,
  diceDividedBy2,
  dicePlus2,
  diceMinus2,
  forward3,
  backward3,
  loan,
}

export const PlayerSchema = SchemaFactory.createForClass(Player);
