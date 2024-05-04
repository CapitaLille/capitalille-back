import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type LobbyDocument = HydratedDocument<Player>;

@Schema()
export class Player {
  @Prop({ required: true })
  user: mongoose.Types.ObjectId;
  @Prop({ required: true })
  lobby: mongoose.Types.ObjectId;
  @Prop({ required: true })
  houses: mongoose.Types.ObjectId;
  @Prop({ required: true, default: 0 })
  money: number;
  @Prop({ required: true, default: 2.5 })
  rating: number;
  @Prop({ required: true, default: [] })
  transactions: Transaction[];
  @Prop({ required: true, default: false })
  turnPlayed: boolean;
  @Prop({ required: true, default: false })
  actionPlayed: boolean;
}

export interface Transaction {
  amount: number;
  from: string;
  to: string;
  type: string;
}

export const LobbySchema = SchemaFactory.createForClass(Player);
