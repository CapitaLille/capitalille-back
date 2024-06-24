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
import { Bank, Doc, GameEvent } from 'src/server/server.type';
import { Player } from 'src/player/player.schema';

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

  async createPrivate(createLobbyDto: CreateLobbyDto, ownerId: string) {
    console.log(createLobbyDto);
    const session = await this.connection.startSession();
    let lobbyId = '';
    try {
      session.startTransaction();
      // Créez le lobby
      const newLobbyId = new mongoose.Types.ObjectId();
      const lobbyCode = nanoid(6);
      const users = createLobbyDto.users;
      if (!users.includes(ownerId)) {
        users.push(ownerId);
      }
      const lobby = new this.lobbyModel({
        _id: newLobbyId,
        owner: ownerId,
        users: users,
        map: createLobbyDto.map,
        private: true,
        turnSchedule: createLobbyDto.turnSchedule,
        turnCount: createLobbyDto.turnCountMax,
        turnCountMax: createLobbyDto.turnCountMax,
        startTime: new Date(),
        started: false,
        code: lobbyCode,
      });

      // Vérification que la carte existe
      const map = await this.mapService.findOne(createLobbyDto.map);
      if (!map) {
        throw new NotFoundException('Map not found');
      }

      const newLobby = await lobby.save();

      const operations = [];
      const owner = await this.userService.findByIdAndUpdate(ownerId, {
        $push: { lobbies: newLobby.id },
      });

      // Créez le joueur du propriétaire.

      operations.push(this.playerService.create(owner, newLobby, map));
      for (let i = 0; i < createLobbyDto.users.length; i++) {
        // Envoyez une notification à chaque utilisateur.
        if (createLobbyDto.users[i] !== ownerId) {
          operations.push(
            this.userService.pushNotification({
              from: ownerId,
              to: createLobbyDto.users[i],
              attached: newLobby.id,
              type: 'gameInvite',
            }),
          );
        }
      }

      // Créez les maisons
      const createLobbyHousesDto: CreateLobbyHousesDto = {
        lobby: newLobbyId,
        map: map,
      };
      await Promise.all(operations);
      await this.userService.statisticsUpdate(
        ownerId,
        AchievementType.gameCreator,
      );
      lobbyId = newLobby.id;
      await this.houseService.generateLobbyHouses(createLobbyHousesDto),
        await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Fermez la session
      session.endSession();
    }

    return lobbyId;
  }

  async createPublic(createLobbyDto: CreateLobbyDto) {
    const session = await this.connection.startSession();
    let lobbyId = '';
    try {
      session.startTransaction();
      // Créez le lobby
      const newLobbyId = new mongoose.Types.ObjectId();
      const lobbyCode = nanoid(6);
      const newLobby = new this.lobbyModel({
        _id: newLobbyId,
        owner: Bank.id,
        code: lobbyCode,
        users: [],
        map: createLobbyDto.map,
        private: false,
        turnSchedule: createLobbyDto.turnSchedule,
        turnCount: createLobbyDto.turnCountMax,
        turnCountMax: createLobbyDto.turnCountMax,
        startTime: new Date(),
        started: false,
      });
      // Vérification que la carte existe
      const map = await this.mapService.findOne(createLobbyDto.map);
      if (!map) {
        throw new NotFoundException('Map not found');
      }
      // Créez les maisons
      const createLobbyHousesDto: CreateLobbyHousesDto = {
        lobby: newLobbyId,
        map: map,
      };
      const newL = await newLobby.save();
      lobbyId = newL.id;
      await this.houseService.generateLobbyHouses(createLobbyHousesDto);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    return lobbyId;
  }

  async joinLobby(
    lobbyId: string,
    userId: string,
    socket: Server,
    code: string = '',
  ): Promise<Doc<Player>> {
    const lobby = await this.lobbyModel.findById(lobbyId);
    const user = await this.userService.findOne(userId);
    const player = await this.playerService.findOneByUserId(userId, lobbyId);
    if (player) {
      throw new ForbiddenException('Votre joueur est déjà dans le lobby');
    }
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    if (!lobby) {
      throw new NotFoundException('Lobby non trouvé');
    }
    if (
      lobby.users.length >= lobby.maxPlayers &&
      !lobby.users.includes(userId)
    ) {
      throw new ForbiddenException('Lobby complet');
    }
    if (lobby.private && lobby.code !== code && !lobby.users.includes(userId)) {
      throw new ForbiddenException('Code de lobby incorrect');
    }
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const map = await this.mapService.findOne(lobby.map);
      const player = await this.playerService.create(user, lobby, map);
      if (!user.lobbies.includes(lobbyId)) {
        await this.userService.findByIdAndUpdate(userId, {
          $push: { lobbies: lobbyId },
        });
      }
      if (!lobby.users.includes(userId)) {
        await this.lobbyModel.findByIdAndUpdate(lobbyId, {
          $push: { users: userId },
        });
      }
      socket
        .in(lobbyId)
        .emit(GameEvent.NEW_PLAYER, { user: user, player: player });
      await session.commitTransaction();
      return player;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findMultiple(ids: string[]) {
    return await this.lobbyModel.find({ _id: { $in: ids } });
  }

  async deleteLobby(lobbyId: string) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const lobby = await this.lobbyModel.findByIdAndDelete(lobbyId);
      if (!lobby || !lobby._id) {
        throw new NotFoundException('Lobby not found');
      }
      console.log('delete lobby', lobbyId);
      await this.playerService.deleteAllFromLobby(lobbyId);
      await this.houseService.destroyLobbyHouses(lobbyId);
      await this.playerService.deleteAllFromLobby(lobbyId);

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

  async findAllPublicRunning() {
    return await this.lobbyModel.find({
      private: false,
      turnCount: { $gt: 0 },
    });
  }

  async findAllRunning(): Promise<Doc<Lobby>[]> {
    return await this.lobbyModel.find({ started: true, turnCount: { $gt: 0 } });
  }

  async findAllFinished(): Promise<Doc<Lobby>[]> {
    // turnCount <= 0
    return await this.lobbyModel.find({ turnCount: { $lte: 0 } });
  }

  async findOne(lobbyId: string) {
    return await this.lobbyModel.findById(lobbyId);
  }

  async findAllFromUser(userId: string) {
    const user = await this.userService.findOne(userId);
    const ids = user.lobbies;
    const lobbies = await this.lobbyModel.find({ _id: { $in: ids } });
    const extendedLobbies = [];
    for (const lobby of lobbies) {
      const promises = [];
      const userIds = lobby.users;
      promises.push(await this.userService.findByIds(userIds, 3));
      promises.push(await this.mapService.findOne(lobby.map));
      promises.push(await this.playerService.findOneByUserId(userId, lobby.id));
      const [users, map, player] = await Promise.all(promises);
      extendedLobbies.push({ lobby, map, users, player });
    }
    return extendedLobbies;
  }

  async findPublic(page: number = 0) {
    const lobbies = await this.lobbyModel
      .find({ private: false })
      .sort({ startTime: -1 })
      .skip(page * 10)
      .limit(10)
      .exec();
    const extendedLobbies = [];
    for (const lobby of lobbies) {
      const promises = [];
      const userIds = lobby.users;
      promises.push(await this.userService.findByIds(userIds, 3));
      promises.push(await this.mapService.findOne(lobby.map));
      const [users, map, player] = await Promise.all(promises);
      extendedLobbies.push({ lobby, map, users });
    }
    return extendedLobbies;
  }

  async findByIdAndUpdate(
    lobbyId: string,
    update: mongoose.UpdateQuery<Lobby>,
    server: Server,
  ) {
    const lobby = await this.lobbyModel.findByIdAndUpdate(lobbyId, update, {
      new: true,
    });
    server.to(lobbyId).emit(GameEvent.LOBBY_UPDATE, { lobby: lobby });
    return lobby;
  }

  async findPrivate(code: string): Promise<Doc<Lobby> | undefined> {
    const lobby = await this.lobbyModel.findOne({ code: code });
    if (!lobby) {
      return undefined;
    }
    return lobby;
  }
}
