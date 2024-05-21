import { Injectable } from '@nestjs/common';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Map } from './map.schema';
import mongoose, { Model } from 'mongoose';

@Injectable()
export class MapService {
  constructor(@InjectModel('Map') private readonly mapModel: Model<Map>) {}

  async create(createMapDto: CreateMapDto) {
    return await this.mapModel.create(createMapDto);
  }

  async findAll() {
    return await this.mapModel.find();
  }

  async findOne(id: number | mongoose.Types.ObjectId) {
    return await this.mapModel.findById(id);
  }

  update(id: number, updateMapDto: UpdateMapDto) {
    return `This action updates a #${id} map`;
  }

  remove(id: number) {
    return `This action removes a #${id} map`;
  }
}
