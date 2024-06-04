import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ArrayUnique } from 'class-validator';
import mongoose, { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum AchievementType {
  // thiefLeague = 'thiefLeague',
  mafiaLeague = 'mafiaLeague',
  annuitantLeague = 'annuitantLeague',
  studentLeague = 'studentLeague',
  payMe = 'payMe',
  monumentsRestorer = 'monumentsRestorer',
  auctionBuyer = 'auctionBuyer',
  auctionWinner = 'auctionWinner',
  copsComplainer = 'copsComplainer',
  friend = 'friend',
  gameCreator = 'gameCreator',
  playGame = 'playGame',
  winGame = 'winGame', // not implemented
  diceLauncher = 'diceLauncher',
  liveOnLoan = 'liveOnLoan',
  gambler = 'gambler',
  frauder = 'frauder',
  student = 'student',
  teleport = 'teleport',
}

export enum AchievementLevel {
  zero = 0, // 1
  one = 1, // 10
  two = 2, // 100
  three = 3, // 250
  four = 4, // 500
}

export class AchievementClass {
  name: AchievementType;
  level: AchievementLevel[];

  constructor({
    name,
    level,
  }: {
    name: AchievementType;
    level: AchievementLevel[];
  }) {
    this.name = name;
    this.level = level;
  }
}

export class Achievement {
  // static thiefLeague = new AchievementClass({
  //   type: AchievementType.thiefLeague,
  //   level: [AchievementLevel.zero],
  // });
  static mafiaLeague = new AchievementClass({
    name: AchievementType.mafiaLeague,
    level: [AchievementLevel.zero],
  });
  static annuitantLeague = new AchievementClass({
    name: AchievementType.annuitantLeague,
    level: [AchievementLevel.zero],
  });
  static studentLeague = new AchievementClass({
    name: AchievementType.studentLeague,
    level: [AchievementLevel.zero],
  });
  static payMe = new AchievementClass({
    name: AchievementType.payMe,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
      AchievementLevel.four,
    ],
  });
  static monumentsRestorer = new AchievementClass({
    name: AchievementType.monumentsRestorer,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
      AchievementLevel.four,
    ],
  });
  static auctionBuyer = new AchievementClass({
    name: AchievementType.auctionBuyer,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
      AchievementLevel.four,
    ],
  });
  static auctionWinner = new AchievementClass({
    name: AchievementType.auctionWinner,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
      AchievementLevel.four,
    ],
  });
  static copsComplainer = new AchievementClass({
    name: AchievementType.copsComplainer,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static friend = new AchievementClass({
    name: AchievementType.friend,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static gameCreator = new AchievementClass({
    name: AchievementType.gameCreator,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static playGame = new AchievementClass({
    name: AchievementType.playGame,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static winGame = new AchievementClass({
    name: AchievementType.winGame,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static diceLauncher = new AchievementClass({
    name: AchievementType.diceLauncher,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static liveOnLoan = new AchievementClass({
    name: AchievementType.liveOnLoan,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static gambler = new AchievementClass({
    name: AchievementType.gambler,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static frauder = new AchievementClass({
    name: AchievementType.frauder,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static student = new AchievementClass({
    name: AchievementType.student,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
  static teleport = new AchievementClass({
    name: AchievementType.teleport,
    level: [
      AchievementLevel.zero,
      AchievementLevel.one,
      AchievementLevel.two,
      AchievementLevel.three,
    ],
  });
}

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

  @Prop({
    required: false,
    default: {
      housesBuyed: 0,
      housesSold: 0,
      gamesPlayed: 0,
      gamesWon: 0,
    },
    type: {
      housesBuyed: Number,
      housesSold: Number,
      monumentsRestored: Number,
      auctionsWon: Number,
      complaints: Number,
      gamesCreated: Number,
      gamesPlayed: Number,
      gamesWon: Number,
      dicesLaunched: Number,
      loans: Number,
      moneyRentReceived: Number,
      rentFraud: Number,
      casinos: Number,
    },
  })
  statistics: {
    housesBuyed: number;
    housesSold: number;
    monumentsRestored: number;
    auctionsWon: number;
    auctionsBought: number;
    complaints: number;
    gamesCreated: number;
    gamesPlayed: number;
    gamesWon: number;
    dicesLaunched: number;
    loans: number;
    moneyReceived: number;
    rentFraud: number;
    casinos: number;
    diplomas: number;
    teleport: number;
  };
  @Prop({
    required: false,
    default: [],
    type: [
      {
        name: String,
        level: [Number],
      },
    ],
  })
  @ArrayUnique()
  achievements: {
    name: AchievementType;
    level: [number];
  }[];
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
