import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type HistoryDocument = HydratedDocument<History>;

@Schema()
export class History {
  @Prop({ required: true })
  lobby: string;

  @Prop({ required: true })
  mapName: string;

  @Prop({ required: true })
  players: PlayerHistory[];

  @Prop({ required: true })
  turnCount: number;

  @Prop({ required: true })
  turnSchedule: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  end: Date;
}

@Schema()
export class PlayerHistory {
  @Prop({ required: true })
  user: string;

  @Prop({ required: true })
  houseCount: number;

  @Prop({ required: true })
  hostelCount: number;

  @Prop({ required: true })
  transactionCount: number;

  @Prop({ required: true })
  moneyCount: number;

  @Prop({ required: true })
  rank: number;

  @Prop({ required: true })
  trophyCount: number;
}

export const HistorySchema = SchemaFactory.createForClass(History);
