import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type LobbyDocument = HydratedDocument<Map>;

@Schema()
export class House {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  objectName: string;

  @Prop({ required: true, type: [Number] })
  price: [number, number, number, number]; // buy price house 1, upgrade price house 2, hostel 1, hostel 2

  @Prop({ required: true, type: [Number] })
  rent: [number, number, number, number]; // rent price house 1, house 2, hostel 1, hostel 2

  @Prop({ required: true })
  cases: number[];

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

  @Prop({ required: false })
  nextStationCaseIndex: number;

  @Prop({ required: false })
  linkedHouseIndex: number;
}

export enum CaseType {
  METRO = 'metro',
  BUS = 'bus',
  BANK = 'bank',
  EVENT = 'event',
  START = 'start',
  HOUSE = 'house',
  INTERSECTION = 'intersection',
  MONUMENTS = 'monuments',
  COPS = 'police',
  SCHOOL = 'school',
}

export enum CaseEventType {
  DICE_DOUBLE = 'dice_double',
  ELECTRICITY_FAILURE = 'electricity_failure',
  WATER_FAILURE = 'water_failure',
  FIRE_FAILURE = 'fire_failure',
  RENT_DISCOUNT = 'rent_discount',
  CASINO = 'casino',
}

export const CaseEvent = [
  { code: CaseEventType.DICE_DOUBLE, dropRate: 0.1 },
  { code: CaseEventType.ELECTRICITY_FAILURE, dropRate: 0.1 },
  { code: CaseEventType.WATER_FAILURE, dropRate: 0.1 },
  { code: CaseEventType.FIRE_FAILURE, dropRate: 0.1 },
  { code: CaseEventType.RENT_DISCOUNT, dropRate: 0.1 },
  { code: CaseEventType.CASINO, dropRate: 0.3 },
];

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
  repairCost: number;

  @Prop({
    required: false,
    default: { value: 2, chance: 0.5 },
    type: { value: Number, chance: Number },
  })
  casino: { value: number; chance: number };

  @Prop({ required: false, default: 0.1 })
  copsMalus: number;

  @Prop({
    required: false,
    default: { cost: 100000, bonus: 50000 },
    type: { cost: Number, bonus: Number },
  })
  school: { cost: number; bonus: number };

  @Prop({ required: false, default: 0 })
  price: number;

  @Prop({ required: false, default: 3 })
  playerRange: number;

  @Prop({ required: false, default: 100000 })
  metroPrice: number;

  @Prop({ required: false, default: 100000 })
  busPrice: number;

  @Prop({ required: false, default: 0.3 })
  fraudChance: number;

  @Prop({ required: false, default: 10 })
  auctionStepPourcent: number; // 0 to 100
}

@Schema()
export class Monument {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, type: [Number] })
  coordinates: [number, number];

  @Prop({ required: true })
  objectName: string;

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ required: true, type: Number })
  bonus: number;

  @Prop({ required: true })
  cases: number[];
}

export const ConfigurationSchema = SchemaFactory.createForClass(Configuration);

@Schema()
export class Map {
  @Prop({ required: true, type: [HouseConfigSchema] })
  houses: House[];

  @Prop({ required: true, type: [CaseConfigSchema] })
  cases: Case[];

  @Prop({ required: true, type: [Monument] })
  monuments: Monument[];

  @Prop({ required: true, type: ConfigurationSchema })
  configuration: Configuration;
}

export const MapSchema = SchemaFactory.createForClass(Map);
