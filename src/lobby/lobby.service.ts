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
    try {
      session.startTransaction();

      // Créez le lobby
      const newLobbyId = new mongoose.Types.ObjectId();
      const lobbyCode = nanoid(6);
      const newLobby = new this.lobbyModel({
        _id: newLobbyId,
        owner: ownerId,
        users: createLobbyDto.users,
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
      if (createLobbyDto.users.find((user) => user === ownerId) === undefined) {
        createLobbyDto.users.push(ownerId);
      }
      // Créez les joueurs
      for (let i = 0; i < createLobbyDto.users.length; i++) {
        operations.push(
          this.playerService.create(
            createLobbyDto.users[i],
            newLobbyId.toString(),
          ),
        );
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
      await newLobby.save();
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
    if (user.lobbys.includes(lobbyId)) {
      throw new ForbiddenException('User already in lobby');
    }
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      user.lobbys.push(lobbyId);
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

  async removePlayer(lobbyId: string, userId: string) {
    const lobby = await this.lobbyModel.findById(lobbyId);
    const user = await this.userService.findOne(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!lobby) {
      throw new NotFoundException('Lobby not found');
    }
    if (!user.lobbys.includes(lobbyId)) {
      throw new ForbiddenException('User not in lobby');
    }
    if (userId === lobby.owner) {
      throw new ForbiddenException('Owner cannot leave lobby');
    }
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      await this.playerService.deleteOneFromLobby(userId, lobbyId);
      await this.houseService.freeHouseFromOwner(userId, lobbyId);
      // Remove conversation of the user.

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

  async findOne(lobbyId: string) {
    return await this.lobbyModel.findById(lobbyId);
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

  async findPrivate(code: string): Promise<
    mongoose.Document<unknown, {}, Lobby> &
      Lobby & {
        _id: mongoose.Types.ObjectId;
      }
  > {
    const lobby = await this.lobbyModel.findOne({ code: code });
    if (!lobby) {
      return undefined;
    }
    return lobby;
  }
}
