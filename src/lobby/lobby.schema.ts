import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LobbyDocument = HydratedDocument<Lobby>;

@Schema()
export class Lobby {
  @Prop({ required: true })
  owner: string;

  @Prop({ required: true })
  players: string[];

  @Prop({ required: true })
  map: string;

  @Prop({ required: true, default: 3600 })
  turnSchedule: number;

  @Prop({ required: true, default: 30 })
  turnCount: number;

  @Prop({ required: true, default: -1 })
  turnCountMax: number;

  @Prop({ required: true, default: new Date() })
  startTime: Date;
}

export const LobbySchema = SchemaFactory.createForClass(Lobby);
