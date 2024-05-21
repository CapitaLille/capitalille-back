import { Injectable } from '@nestjs/common';
import { CreateLobbyHousesDto } from './dto/create-lobby-houses.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, startSession } from 'mongoose';
import { House } from './house.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import { Lobby } from 'src/lobby/lobby.schema';

@Injectable()
export class HouseService {
  constructor(
    @InjectModel('House') private readonly houseModel: Model<House>,
    @InjectModel('Lobby') private readonly lobbyModel: Model<Lobby>,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async generateLobbyHouses(createLobbyHousesDto: CreateLobbyHousesDto) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const lobby = await this.lobbyModel.findById(createLobbyHousesDto.lobby);
      if (!lobby) {
        throw new Error("Can't generate houses for a non-existing lobby");
      }
      let promises = [];
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
          owner: '',
          next_owner: '',
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

  async destroyLobbyHouses(lobbyId: mongoose.Types.ObjectId) {
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

  async findAll(lobby: number) {
    return await this.houseModel.find({ lobby });
  }

  async findOne(lobby: number, index: number) {
    return await this.houseModel.findOne({ lobby, index });
  }
}
