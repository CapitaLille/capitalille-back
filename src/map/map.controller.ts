import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MapService } from './map.service';
import { CreateMapDto } from './dto/create-map.dto';
import { UpdateMapDto } from './dto/update-map.dto';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { Map } from './map.schema';
import { ObjectId } from 'mongodb';
import { idDto } from 'src/app.dto';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Post()
  async create(@Body() createMapDto: CreateMapDto) {
    return await this.mapService.create(createMapDto);
  }

  @Get(':id')
  findOne(@Param('id') mapId: string) {
    return this.mapService.findOne(mapId);
  }
}
