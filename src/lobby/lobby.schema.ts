import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { lobbyConstants } from 'src/user/constants';

export type LobbyDocument = HydratedDocument<Lobby>;

@Schema()
export class Lobby {
  @Prop({ required: true })
  owner: string;

  @Prop({ required: true })
  users: string[];

  @Prop({ required: true })
  map: string;

  @Prop({
    required: true,
    default: 3600,
    min: lobbyConstants.restrictions.minScheduledTurn,
    max: lobbyConstants.restrictions.maxScheduledTurn,
  })
  turnSchedule: number;

  @Prop({ required: true, default: 30, min: 0 })
  turnCount: number;

  @Prop({
    required: true,
    default: -1,
    min: lobbyConstants.restrictions.minTurnCount,
    max: lobbyConstants.restrictions.maxTurnCount,
  })
  turnCountMax: number;

  @Prop({ required: true, default: new Date() })
  startTime: Date;

  @Prop({ required: true, default: 4 })
  maxPlayers: number;

  @Prop({ required: false, maxlength: 6, minlength: 6 })
  code: string;

  @Prop({ required: true, default: false })
  started: boolean;

  @Prop({ required: true, default: false })
  private: boolean;
}

export const LobbySchema = SchemaFactory.createForClass(Lobby);
