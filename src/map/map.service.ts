import { Injectable } from '@nestjs/common';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CaseType, Map } from './map.schema';
import mongoose, { Model } from 'mongoose';

@Injectable()
export class MapService {
  constructor(@InjectModel('Map') private readonly mapModel: Model<Map>) {}

  async create(createMapDto: CreateMapDto) {
    return await this.mapModel.create(createMapDto);
  }

  async createFake() {
    const cases = [
      {
        last: [8],
        next: [1],
        type: CaseType.HOUSE,
        coordinates: [0, 0],
      },
      {
        last: [0],
        next: [2],
        type: CaseType.HOUSE,
        coordinates: [0, 1],
      },
      {
        last: [1],
        next: [3],
        type: CaseType.HOUSE,
        coordinates: [0, 2],
      },
      {
        last: [2],
        next: [4],
        type: CaseType.HOUSE,
        coordinates: [0, 3],
      },
      {
        last: [3],
        next: [5],
        type: CaseType.HOUSE,
        coordinates: [0, 4],
      },
      {
        last: [4],
        next: [6],
        type: CaseType.HOUSE,
        coordinates: [0, 5],
      },
      {
        last: [5],
        next: [7],
        type: CaseType.HOUSE,
        coordinates: [0, 6],
      },
      {
        last: [6],
        next: [8],
        type: CaseType.HOUSE,
        coordinates: [0, 7],
      },
      {
        last: [7],
        next: [0],
        type: CaseType.HOUSE,
        coordinates: [0, 8],
      },
    ];

    const houses = [
      {
        name: 'Villa la rotonde',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [0],
        coordinates: [0, 0],
      },
      {
        name: 'Villa marguerite',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [1],
        coordinates: [0, 1],
      },
      {
        name: 'Villa la rotonde',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [2],
        coordinates: [0, 2],
      },
      {
        name: 'Villa marguerite',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [3],
        coordinates: [0, 3],
      },
      {
        name: 'Villa la rotonde',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [4],
        coordinates: [0, 4],
      },
      {
        name: 'Villa marguerite',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [5],
        coordinates: [0, 5],
      },
      {
        name: 'Villa la rotonde',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [6],
        coordinates: [0, 6],
      },
      {
        name: 'Villa marguerite',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [7],
        coordinates: [0, 7],
      },
      {
        name: 'Villa la rotonde',
        price: [200, 300, 400, 500],
        rent: [20, 40, 60, 80],
        cases: [8],
        coordinates: [0, 8],
      },
    ];

    console.log('create fake map2');
    return await this.mapModel.create({
      cases: cases,
      houses: houses,
      configuration: {
        name: 'Default',
        description: 'Default configuration',
        salary: 200,
        ratingMultiplicator: [0.8, 1.2],
        bank: { tax: 0.1, value: 1000 },
        diplomeBonus: 50000,
        maxPlayer: 4,
        minPlayer: 2,
        starting: { money: 1000, rating: 1000 },
        defectRate: { fire: 0.1, water: 0.1, electricity: 0.1 },
        parkRatingBonus: 1,
        price: 1000,
        playerRange: 3,
        auctionStepPourcent: 10,
      },
    });
  }

  async findOne(mapId: string) {
    return await this.mapModel.findById(mapId);
  }

  async findAll() {
    return await this.mapModel.find();
  }
}
