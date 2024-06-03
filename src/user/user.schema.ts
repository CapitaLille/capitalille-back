import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  nickname: string;

  @Prop({ required: true, default: [] })
  lobbys: string[];

  @Prop({ required: true, default: [] })
  friends: string[];

  @Prop({ required: true, default: 0 })
  credit: number;

  @Prop({ required: false, default: '' })
  pp: string;

  @Prop({ required: false, default: 0, min: 0 })
  trophies: number;

  @Prop({ required: true, default: [] })
  notifications: Notification[];
}

@Schema()
export class Notification {
  @Prop({ required: true })
  uid: string; // nanoid 20.
  @Prop({ required: true })
  from: string;
  @Prop({ required: false, default: '' })
  attached: string;
  @Prop({ required: true })
  type:
    | 'gameInvite'
    | 'gameStart'
    | 'gameEnd'
    | 'gameTurn'
    | 'gameAction'
    | 'gameMessage'
    | 'friendRequest';
  @Prop({ required: true })
  date: Date;
  @Prop({ required: true })
  read: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
