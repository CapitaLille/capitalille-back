import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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

  @Prop({ required: true, default: 0 })
  credit: string[];

  @Prop({ required: true, default: '' })
  profile_picture: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
