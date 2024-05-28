import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type HouseDocument = HydratedDocument<House>;

export enum houseState {
  FREE = 'free',
  SALE = 'sale',
  OWNED = 'owned',
}

@Schema()
export class House {
  @Prop({ required: true })
  index: number; // index of the house in the map document

  @Prop({ required: true })
  lobby: string;

  @Prop({ required: false, default: '' })
  owner: string;

  @Prop({ required: false, default: '' })
  nextOwner: string;

  @Prop({ required: true })
  auction: number;

  @Prop({ required: true, type: [Number] })
  price: [number, number, number, number]; // buy price house 1, upgrade price house 2, hostel 1, hostel 2

  @Prop({ required: true, type: [Number] })
  rent: [number, number, number, number]; // rent price house 1, house 2, hostel 1, hostel 2

  @Prop({ required: false, default: 0 })
  level: 0 | 1 | 2 | 3; // 0: house 1, 1: house 2, 2: hostel 1, 3: hostel 2

  @Prop({ required: false, default: houseState.FREE })
  state: houseState;

  @Prop({
    required: true,
    type: { fire: Boolean, water: Boolean, electricity: Boolean },
  })
  defect: {
    fire: boolean;
    water: boolean;
    electricity: boolean;
  };

  @Prop({
    required: true,
    type: { fire: Boolean, water: Boolean, electricity: Boolean },
  })
  activeDefect: {
    fire: boolean;
    water: boolean;
    electricity: boolean;
  };
}

export const HouseSchema = SchemaFactory.createForClass(House);
