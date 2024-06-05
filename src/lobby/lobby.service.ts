import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lobby } from './lobby.schema';
import mongoose from 'mongoose';
import { PlayerService } from 'src/player/player.service';
import { UserService } from 'src/user/user.service';
import { nanoid } from 'nanoid';
import { HouseService } from 'src/house/house.service';
import { MapService } from 'src/map/map.service';
import { CreateLobbyHousesDto } from 'src/house/dto/create-lobby-houses.dto';
import { AchievementType } from 'src/user/user.schema';
import { Server } from 'socket.io';
import { ServerGuardSocket } from 'src/server/server.gateway';
import { Doc, GameEvent } from 'src/server/server.type';

@Injectable()
export class LobbyService {
  constructor(
    @InjectModel('Lobby') private readonly lobbyModel: Model<Lobby>,
    private readonly playerService: PlayerService,
    private readonly userService: UserService,
    private readonly mapService: MapService,
    private readonly houseService: HouseService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async create(createLobbyDto: CreateLobbyDto, ownerId: string) {
    const session = await this.connection.startSession();
    console.log('createLobbyDto', createLobbyDto);
    try {
      session.startTransaction();
      // Créez le lobby
      const newLobbyId = new mongoose.Types.ObjectId();
      const lobbyCode = nanoid(6);
      let users = createLobbyDto.users;
      if (!users.includes(ownerId)) {
        users.push(ownerId);
      }
      let newLobby = new this.lobbyModel({
        _id: newLobbyId,
        owner: ownerId,
        users: users,
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
      const map = await this.mapService.findOne(createLobbyDto.map);
      if (!map) {
        throw new NotFoundException('Map not found');
      }

      const operations = [];
      await this.userService.findByIdAndUpdate(ownerId, {
        $push: { lobbies: newLobbyId },
      });

      // Créez le joueur du propriétaire.
      operations.push(
        this.playerService.create(ownerId, newLobbyId.toString()),
      );
      for (let i = 0; i < createLobbyDto.users.length; i++) {
        // Envoyez une notification à chaque utilisateur.
        operations.push(
          this.userService.pushNotification({
            from: createLobbyDto.users[i],
            to: createLobbyDto.users[i],
            attached: newLobbyId.toString(),
            type: 'gameInvite',
          }),
        );
      }

      // Créez les maisons
      const createLobbyHousesDto: CreateLobbyHousesDto = {
        lobby: newLobbyId,
        map: map,
      };
      await Promise.all(operations);
      const newL = await newLobby.save();
      console.log('newL', newL);
      await this.userService.statisticsUpdate(
        ownerId,
        AchievementType.gameCreator,
      );
      await this.houseService.generateLobbyHouses(createLobbyHousesDto),
        await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Fermez la session
      session.endSession();
    }

    return HttpStatus.CREATED;
  }

  async joinLobby(
    lobbyId: string,
    userId: string,
    socket: Server | ServerGuardSocket,
    code: string = '',
  ) {
    const lobby = await this.lobbyModel.findById(lobbyId);
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    if (lobby.users.length >= lobby.maxPlayers) {
      throw new ForbiddenException('Lobby is full');
    }
    if (user.lobbies.includes(lobbyId)) {
      throw new ForbiddenException('User already in lobby');
    }
    if (lobby.private && lobby.code !== code && !lobby.users.includes(userId)) {
      throw new ForbiddenException('Invalid code');
    }
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      user.lobbies.push(lobbyId);
      const player = await this.playerService.create(userId, lobbyId);
      await this.userService.findByIdAndUpdate(userId, {
        $push: { lobbys: lobbyId },
      });
      socket
        .to(lobbyId)
        .emit(GameEvent.NEW_USER, { user: user, player: player });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    return HttpStatus.ACCEPTED;
  }

  async addPlayer(lobbyId: string, userId: string) {
    const lobby = await this.lobbyModel.findById(lobbyId);
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    if (lobby.users.length >= lobby.maxPlayers) {
      throw new ForbiddenException('Lobby is full');
    }
    if (user.lobbies.includes(lobbyId)) {
      throw new ForbiddenException('User already in lobby');
    }
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      user.lobbies.push(lobbyId);
      await this.playerService.create(userId, lobbyId);
      await this.userService.update(userId, user);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

    return HttpStatus.ACCEPTED;
  }

  async deleteLobby(lobbyId: string) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const lobby = await this.lobbyModel.findByIdAndDelete(lobbyId);
      if (!lobby || !lobby._id) {
        throw new NotFoundException('Lobby not found');
      }
      await this.playerService.deleteAllFromLobby(lobbyId);
      await this.houseService.destroyLobbyHouses(lobbyId);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Fermez la session
      session.endSession();
    }
    return HttpStatus.ACCEPTED;
  }

  async findAll() {
    return await this.lobbyModel.find();
  }

  async findAllFromUser(userId: string, page: number = 0) {
    const lobbies = await this.lobbyModel
      .find({ $in: { users: userId } })
      .sort({ startTime: -1 })
      .skip(page * 10)
      .limit(10)
      .exec();
    const extendedLobbies = [];
    for (const lobby of lobbies) {
      const users = await this.userService.findSomeFromLobby(lobby.id, 3);
      extendedLobbies.push({ lobby, users });
    }
  }

  async findOne(lobbyId: string) {
    return await this.lobbyModel.findById(lobbyId);
  }

  async present(lobbyId: string) {
    const lobby = await this.lobbyModel.findById(lobbyId);
    const users = await this.userService.findSomeFromLobby(lobbyId, 3);
    const map = await this.mapService.findOne(lobby.map);
    return { lobby, users, map };
  }

  async presents(lobbyIds: string[]) {
    const lobbies = await this.lobbyModel.find({ _id: { $in: lobbyIds } });
    const extendedLobbies = [];
    for (const lobby of lobbies) {
      const users = await this.userService.findSomeFromLobby(lobby.id, 3);
      const map = await this.mapService.findOne(lobby.map);
      extendedLobbies.push({ lobby, users, map });
    }
    return extendedLobbies;
  }

  async findPublic(date: Date, page: number, limit: number) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const skip = (page - 1) * limit;

    const lobbys = this.lobbyModel
      .find({
        startTime: {
          $gte: start,
          $lt: end,
        },
        code: { $exists: false },
      })
      .skip(skip)
      .limit(limit)
      .exec();

    if (!lobbys) {
      throw new NotFoundException('No lobbys found');
    }
    return lobbys;
  }

  async findAllRunning(): Promise<Doc<Lobby>[]> {
    return await this.lobbyModel.find({ started: true, turnCount: { $gt: 0 } });
  }

  async findByIdAndUpdate(
    lobbyId: string,
    update: mongoose.UpdateQuery<Lobby>,
  ) {
    return await this.lobbyModel.findByIdAndUpdate(lobbyId, update);
  }

  async findPrivate(code: string): Promise<Doc<Lobby> | undefined> {
    const lobby = await this.lobbyModel.findOne({ code: code });
    if (!lobby) {
      return undefined;
    }
    return lobby;
  }
}
