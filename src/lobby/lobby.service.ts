import { HttpStatus, Injectable, UseGuards } from '@nestjs/common';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyDto } from './dto/update-lobby.dto';
import { InjectModel } from '@nestjs/mongoose';
import Session, { ClientSession, Model, startSession } from 'mongoose';
import { User } from 'src/user/user.schema';
import { JwtService } from '@nestjs/jwt';
import { Lobby } from './lobby.schema';
import mongoose from 'mongoose';
import { PlayerService } from 'src/player/player.service';
import { CreatePlayerDto } from 'src/player/dto/create-player.dto';
import { lobbyConstants } from 'src/user/constants';
import { UserService } from 'src/user/user.service';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { AuthGuard } from 'src/auth/auth.guard';

@Injectable()
@UseGuards(AuthGuard)
export class LobbyService {
  constructor(
    private jwt: JwtService,
    @InjectModel('Lobby') private readonly lobbyModel: Model<Lobby>,
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly playerService: PlayerService,
    private readonly userService: UserService,
  ) {}

  async create(createLobbyDto: CreateLobbyDto, owner: string) {
    let session: ClientSession = null;
    try {
      session = await startSession();
      session.startTransaction();

      // Créez le lobby
      const newLobbyId = new mongoose.Types.ObjectId();
      const lobbyCode = nanoid(6);

      const newLobby = new this.lobbyModel({
        _id: newLobbyId,
        owner,
        players: createLobbyDto.players,
        map: createLobbyDto.map,
        turnSchedule: createLobbyDto.turnSchedule,
        turnCount: 0,
        turnCountMax: createLobbyDto.turnCountMax,
        startTime: new Date(),
        started: false,
      });
      if (createLobbyDto.code) {
        newLobby.code = lobbyCode;
      }

      // Vérification que la carte existe
      console.warn('TODO: Vérification que la carte existe');

      let operations = [];

      // Créez les joueurs
      for (let i = 0; i < createLobbyDto.players.length; i++) {
        let player = new CreatePlayerDto();
        player.user = createLobbyDto.players[i];
        player.lobby = newLobbyId;
        player.money = lobbyConstants.starting.money;
        player.rating = lobbyConstants.starting.rating;
        player.transactions = [];
        player.turnPlayed = false;
        player.actionPlayed = false;
        player.houses = [];
        operations.push(this.playerService.create(player));
        operations.push(
          this.userService.pushNotification({
            from: createLobbyDto.players[i],
            to: createLobbyDto.players[i],
            attached: newLobbyId,
            type: 'gameInvite',
          }),
        );
      }

      await Promise.all(operations);
      await newLobby.save();
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Fermez la session
      session.endSession();
    }

    return await this.lobbyModel.create(createLobbyDto);
  }

  async addPlayer(
    lobbyId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    lobby: Lobby,
  ) {
    let lobbyFound = null;
    if (lobby) {
      lobbyFound = lobby;
    } else {
      lobbyFound = await this.lobbyModel.findById(lobbyId);
    }
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }
    if (!lobby) {
      throw new Error('Lobby not found');
    }
    if (lobby.players.length >= lobby.maxPlayers) {
      throw new Error('Lobby is full');
    }

    user.lobbys.push(lobbyId);
    await user.save();

    return HttpStatus.OK;
  }

  findAll() {
    return `This action returns all lobby`;
  }

  findOne(id: number) {
    return `This action returns a #${id} lobby`;
  }

  update(id: number, updateLobbyDto: UpdateLobbyDto) {
    return `This action updates a #${id} lobby`;
  }

  remove(id: number) {
    return `This action removes a #${id} lobby`;
  }
}
