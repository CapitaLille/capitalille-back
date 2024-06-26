import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;
@Schema()
export class Proposal {
  @Prop({ required: true })
  targetHouses: number[];

  @Prop({ required: true })
  targetMoney: number;

  @Prop({ required: true })
  sourceHouses: number[];

  @Prop({ required: true })
  sourceMoney: number;
}

@Schema()
export class Message {
  @Prop({ required: true, type: String })
  content: string;

  @Prop({ required: false })
  proposal: Proposal;

  @Prop({ required: true, type: String })
  sender: string;

  @Prop({ required: true, type: Date })
  time: Date;
}

@Schema()
export class Conversation {
  @Prop({ required: true, type: [String, String] })
  players: string[];

  @Prop({ required: false, default: [] })
  messages: Message[];

  @Prop({ required: false, default: undefined })
  lastMessage: Message;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
