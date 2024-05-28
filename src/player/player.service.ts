import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotImplementedException,
  forwardRef,
} from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Player, playerVaultType, transactionType } from './player.schema';
import { lobbyConstants } from 'src/user/constants';
import { Bank, Doc, GameEvent, MoneyChangeData } from 'src/server/server.type';
import { ServerService } from 'src/server/server.service';
import { ServerGuardSocket } from 'src/server/server.gateway';
import { Map } from 'src/map/map.schema';

@Injectable()
export class PlayerService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
  ) {}

  async create(userId: string, lobbyId: string) {
    const player = new CreatePlayerDto();
    player.user = userId;
    player.lobby = lobbyId;
    player.money = lobbyConstants.starting.money;
    player.rating = lobbyConstants.starting.rating;
    player.transactions = [];
    player.turnPlayed = false;
    player.actionPlayed = false;
    player.houses = [];
    return await this.playerModel.create(player);
  }

  async findAll() {
    return await this.playerModel.find();
  }

  async findOne(userId: string, lobbyId: string) {
    return await this.playerModel.findOne({ user: userId, lobby: lobbyId });
  }

  async findOneById(playerId: string) {
    return await this.playerModel.findById(playerId);
  }

  async findAllFromLobby(lobbyId: string) {
    const players = await this.playerModel.find({ lobby: lobbyId });
    if (!players) {
      return undefined;
    }
    return players;
  }

  async findByIdAndUpdate(playerId: string, update: UpdateQuery<Player>) {
    return await this.playerModel.findByIdAndUpdate(playerId, update);
  }

  update(id: number) {
    return `This action updates a #${id} player`;
  }

  deleteOneFromLobby(userId: string, lobbyId: string): Promise<any> {
    return this.playerModel.deleteOne({ user: userId, lobby: lobbyId });
  }

  deleteAllFromLobby(lobbyId: string): Promise<any> {
    return this.playerModel.deleteMany({ lobby: lobbyId });
  }

  /**
   * Calculate the player salary based on the player bonuses and the map configuration.
   * @param player
   * @param map
   * @returns
   */
  getPlayerSalary(player: Doc<Player>, map: Doc<Map>): number {
    const diplomeCount = player.bonuses.filter(
      (bonus) => bonus === playerVaultType.diploma,
    ).length;
    return (
      map.configuration.salary + map.configuration.diplomeBonus * diplomeCount
    );
  }
}
