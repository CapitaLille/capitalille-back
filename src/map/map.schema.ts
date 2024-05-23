import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type LobbyDocument = HydratedDocument<Map>;

@Schema()
export class House {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: [Number] })
  price: [number, number, number, number]; // buy price house 1, upgrade price house 2, hostel 1, hostel 2

  @Prop({ required: true, type: [Number] })
  rent: [number, number, number, number]; // rent price house 1, house 2, hostel 1, hostel 2

  @Prop({ required: true })
  case: number;

  @Prop({ required: true, type: [Number] })
  coordinates: [number, number];
}

export const HouseConfigSchema = SchemaFactory.createForClass(House);

@Schema()
export class Case {
  @Prop({ required: true, type: [Number] })
  last: number[];

  @Prop({ required: true, type: [Number] })
  next: number[];

  @Prop({ required: true })
  type: CaseType;

  @Prop({ required: true, type: [Number] })
  coordinates: [number, number];
}

export enum CaseType {
  metro,
  bus,
  bank,
  park,
  event,
  default,
  house,
  intersection,
  monuments,
}

export const CaseConfigSchema = SchemaFactory.createForClass(Case);

@Schema()
export class Configuration {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  salary: number;

  @Prop({ required: false, default: [0.8, 1.2] })
  ratingMultiplicator: [number, number];

  @Prop({ required: true, type: { tax: Number, value: Number } })
  bank: { tax: number; value: number };

  @Prop({ required: true })
  maxPlayer: number;

  @Prop({ required: true })
  minPlayer: number;

  @Prop({ required: true, type: { money: Number, rating: Number } })
  starting: {
    money: number;
    rating: number;
  };

  @Prop({
    required: true,
    type: { fire: Number, water: Number, electricity: Number },
  })
  defectRate: {
    fire: number;
    water: number;
    electricity: number;
  };

  @Prop({ required: true })
  parkRatingBonus: number; // 0 to 5

  @Prop({ required: false, default: 0 })
  price: number;
}

export const ConfigurationSchema = SchemaFactory.createForClass(Configuration);

@Schema()
export class Map {
  @Prop({ required: true, type: [HouseConfigSchema] })
  houses: House[];

  @Prop({ required: true, type: [CaseConfigSchema] })
  cases: Case[];

  @Prop({ required: true, type: ConfigurationSchema })
  configuration: Configuration;
}

export const MapSchema = SchemaFactory.createForClass(Map);
