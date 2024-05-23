import { Injectable } from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Player } from './player.schema';
import { lobbyConstants } from 'src/user/constants';

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

  async findAllFromLobby(lobbyId: string) {
    const players = await this.playerModel.find({ lobby: lobbyId });
    if (!players) {
      return undefined;
    }
    return players;
  }

  update(id: number) {
    return `This action updates a #${id} player`;
  }

  deleteOneFromLobby(userId: string, lobbyId: string) {
    return this.playerModel.deleteOne({ user: userId, lobby: lobbyId });
  }

  deleteAllFromLobby(lobbyId: string) {
    return this.playerModel.deleteMany({ lobby: lobbyId });
  }
}
