import { Injectable } from '@nestjs/common';
import { Player } from 'src/player/player.schema';
import { Lobby } from 'src/lobby/lobby.schema';
import { Map } from 'src/map/map.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { History } from './history.schema';
import { Doc } from 'src/server/server.type';
import { House } from 'src/house/house.schema';

@Injectable()
export class HistoryService {
  constructor(
    @InjectModel('History') private readonly historyModel: Model<History>,
  ) {}

  // @Schema()
  // export class History {
  //   @Prop({ required: true })
  //   lobby: string;

  //   @Prop({ required: true })
  //   mapName: string;

  //   @Prop({ required: true })
  //   players: PlayerHistory[];

  //   @Prop({ required: true })
  //   turnCount: number;

  //   @Prop({ required: true })
  //   turnSchedule: string;

  //   @Prop({ required: true })
  //   date: Date;
  // }

  // @Schema()
  // export class PlayerHistory {
  //   @Prop({ required: true })
  //   user: string;

  //   @Prop({ required: true })
  //   houseCount: string;

  //   @Prop({ required: true })
  //   hostelCount: string;

  //   @Prop({ required: true })
  //   transactionCount: string;

  //   @Prop({ required: true })
  //   moneyCount: string;

  //   @Prop({ required: true })
  //   rank: number;

  //   @Prop({ required: true })
  //   trophyCount: string;
  // }

  async create(
    players: Doc<Player>[],
    lobby: Doc<Lobby>,
    houses: Doc<House>[],
    map: Doc<Map>,
    leaderboard: { playerId: string; value: number; trophies: number }[],
  ) {
    console.log('create history strt');
    const playerTmp = [];

    for (const player of players) {
      const trophy = leaderboard.find(
        (leader) => leader.playerId === player.id,
      ).trophies;
      const rank = leaderboard.findIndex(
        (leader) => leader.playerId === player.id,
      );
      if (rank && trophy) {
        console.log('trophy', trophy, 'rank', rank);
        playerTmp.push({
          user: player.user,
          houseCount: houses.filter(
            (house) =>
              house.owner === player.id && [0, 1].includes(house.level),
          ).length,
          hostelCount: houses.filter(
            (house) =>
              house.owner === player.id && [2, 3].includes(house.level),
          ).length,
          transactionCount: player?.transactions?.length
            ? player?.transactions?.length
            : 0,
          moneyCount: player.money,
          rank: rank + 1 ? rank + 1 : -1,
          trophyCount: trophy ? trophy : 0,
        });
      }
    }
    const potHistory = await this.historyModel.findOne({ lobby: lobby.id });
    console.log('potHistory', potHistory);
    if (potHistory) {
      console.log('update history');
      return await this.historyModel.updateOne(
        { lobby: lobby.id },
        {
          lobby: lobby.id,
          mapName: map.configuration.name,
          players: playerTmp,
          turnCount: lobby.turnCount,
          turnSchedule: lobby.turnSchedule,
          date: lobby.startTime,
          end: new Date(),
        },
      );
    } else {
      console.log('create history');
      return await this.historyModel.create({
        lobby: lobby.id,
        mapName: map.configuration.name,
        players: playerTmp,
        turnCount: lobby.turnCount,
        turnSchedule: lobby.turnSchedule,
        date: lobby.startTime,
        end: new Date(),
      });
    }
  }
}
