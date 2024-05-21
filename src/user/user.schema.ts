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
  lobbys: mongoose.Types.ObjectId[];

  @Prop({ required: true, default: [] })
  friends: mongoose.Types.ObjectId[];

  @Prop({ required: true, default: 0 })
  credit: number;

  @Prop({ required: true, default: '' })
  pp: string;

  @Prop({ required: true, default: [] })
  notifications: Notification[];
}

export interface Notification {
  uid: string;
  from: mongoose.Types.ObjectId;
  attached: mongoose.Types.ObjectId;
  type:
    | 'gameInvite'
    | 'gameStart'
    | 'gameEnd'
    | 'gameTurn'
    | 'gameAction'
    | 'gameMessage'
    | 'friend_request';
  date: Date;
  read: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
