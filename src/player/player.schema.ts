import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type PlayerDocument = HydratedDocument<Player>;

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

export const PlayerSchema = SchemaFactory.createForClass(Player);
