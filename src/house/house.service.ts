import {
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { CreateLobbyHousesDto } from './dto/create-lobby-houses.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { House } from './house.schema';
import { Lobby } from 'src/lobby/lobby.schema';
import { Doc, GameEvent } from 'src/server/server.type';
import { Map } from 'src/map/map.schema';
import { Server } from 'socket.io';
import { ServerGateway, ServerGuardSocket } from 'src/server/server.gateway';
import { MapService } from 'src/map/map.service';

@Injectable()
export class HouseService {
  constructor(
    @InjectModel('House') private readonly houseModel: Model<House>,
    @InjectModel('Lobby') private readonly lobbyModel: Model<Lobby>,
    private readonly mapService: MapService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async generateLobbyHouses(createLobbyHousesDto: CreateLobbyHousesDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const lobby = await this.lobbyModel.findById(createLobbyHousesDto.lobby);
      if (!lobby) {
        throw new NotFoundException(
          "Can't generate houses for a non-existing lobby",
        );
      }
      const promises = [];
      for (let i = 0; i < createLobbyHousesDto.map.houses.length; i++) {
        const house = createLobbyHousesDto.map.houses[i];
        const fire =
          Math.random() <
          createLobbyHousesDto.map.configuration.defectRate.fire;
        const water =
          Math.random() <
          createLobbyHousesDto.map.configuration.defectRate.water;
        const electricity =
          Math.random() <
          createLobbyHousesDto.map.configuration.defectRate.electricity;
        const newHouse = new this.houseModel({
          lobby: createLobbyHousesDto.lobby,
          price: house.price,
          rent: house.rent,
          level: 0,
          activeDefect: {
            fire: false,
            water: false,
            electricity: false,
          },
          defect: {
            fire,
            water,
            electricity,
          },
          auction: 0,
          index: i,
        });
        promises.push(newHouse.save());
      }
      await Promise.all(promises);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Fermez la session
      session.endSession();
    }
  }

  async destroyLobbyHouses(lobbyId: string) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      await this.houseModel.deleteMany({ lobby: lobbyId });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      // Fermez la session
      session.endSession();
    }
  }

  async freeHouseFromOwner(ownerId: string, lobbyId: string) {
    const houses = await this.houseModel.find({
      owner: ownerId,
      lobby: lobbyId,
    });
    if (!houses) return;
    return await this.houseModel.updateMany(
      { owner: ownerId, lobby: lobbyId },
      {
        owner: '',
        level: 0,
        activeDefect: { fire: false, water: false, electricity: false },
      },
    );
  }

  async findAllFromLobby(lobbyId: string) {
    const houses = await this.houseModel
      .find({
        lobby: lobbyId,
      })
      .exec();
    if (!houses) {
      return undefined;
    }
    return houses;
  }

  /**
   * Get the auction price of a house based on the map configuration.
   * @param map
   * @param house
   * @returns
   */
  getAuctionPrice(map: Doc<Map>, house: Doc<House>) {
    if (house.auction === 0) {
      return house.price[house.level];
    }
    return Math.round(
      house.auction +
        (map.configuration.auctionStepPourcent * house.auction) / 100,
    );
  }

  async findAllSellingFromLobby(lobbyId: string) {
    return await this.houseModel
      .find({
        lobby: lobbyId,
        state: { $ne: 'owned' },
      })
      .exec();
  }

  async findAll() {
    return await this.houseModel.find();
  }

  async findOne(lobbyId: string, houseIndex: any) {
    const house = await this.houseModel.findOne({
      lobby: lobbyId,
      index: houseIndex,
    });
    if (!house) {
      throw new NotFoundException('House not found');
    }
    return house;
  }

  async findWithCase(
    caseIndex: number,
    lobbyId: string,
    mapId: string,
  ): Promise<
    | (mongoose.Document<unknown, {}, House> &
        House & {
          _id: mongoose.Types.ObjectId;
        })
    | undefined
  > {
    const map = await this.mapService.findOne(mapId);
    if (!map) {
      throw new NotFoundException('Map not found');
    }
    const houses = map.houses;
    const houseIndex = houses.findIndex((house) =>
      house.cases.includes(caseIndex),
    );
    const house = await this.houseModel.findOne({
      lobby: lobbyId,
      index: houseIndex,
    });
    if (!house) {
      return undefined;
    }
    return house;
  }

  async findByIdAndUpdate(
    houseId: string,
    updateHouseDto: mongoose.UpdateQuery<House>,
    socket: Server,
  ): Promise<House> {
    const result = await this.houseModel.findByIdAndUpdate(
      houseId,
      updateHouseDto,
      { new: true },
    );
    if (socket) {
      socket.in(result.lobby).emit(GameEvent.HOUSE_UPDATE, { house: result });
    }
    return result;
  }

  async setHouseFailure(
    playerId: string,
    failure: 'fire' | 'water' | 'electricity',
    socket: Server,
  ) {
    try {
      const result = await this.houseModel.findOneAndUpdate(
        { owner: playerId, [`defect.${failure}`]: true },
        { [`activeDefect.${failure}`]: true },
        { new: true },
      );
      if (socket && result) {
        socket.in(result.lobby).emit(GameEvent.HOUSE_UPDATE, { house: result });
      }
      return result;
    } catch (error) {
      throw new NotFoundException('setHouseFailure : ' + error.message);
    }
  }
}
