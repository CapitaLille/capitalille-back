import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LobbyDocument = HydratedDocument<Map>;

@Schema()
export class Map {
  @Prop({ required: true })
  name: string;
  @Prop({ required: true })
  houses: House[];
  @Prop({ required: true })
  cases: Case[];
  @Prop({ required: true })
  configuration: Configuration;
}

export interface Configuration {
  salary: number;
  bank: [value: number, tax: number];
  maxPlayer: number;
  minPlayer: number;
  starting: {
    money: number;
    rating: number;
  };
  parkRatingBonus: number; // 0 to 5
}

export interface House {
  name: string;
  price: [number, number, number, number]; // Buy price house 1, upgrade price to house 2, hostel 1, hostel 2
  case: number; // Case link id
  coordinates: [number, number]; // x, y
}

export interface Case {
  last: number[];
  next: number[];
  type:
    | 'metro'
    | 'bus'
    | 'bank'
    | 'park'
    | 'event'
    | 'default'
    | 'house'
    | 'intersection'
    | 'monuments';
  coordinates: [number, number]; // x, y
}

export interface extendedCase {
  linkHouse: number; // Identifiant de la maison liée
  nextStation: number; // Métro ou bus
}

export const LobbySchema = SchemaFactory.createForClass(Map);
