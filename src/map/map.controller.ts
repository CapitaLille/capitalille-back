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
import { Model } from 'mongoose';
import { Map } from './map.schema';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Post()
  async create(@Body() createMapDto: CreateMapDto) {
    return await this.mapService.create(createMapDto);
  }

  @Get()
  findAll() {
    return this.mapService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mapService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMapDto: UpdateMapDto) {
    return this.mapService.update(+id, updateMapDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mapService.remove(+id);
  }
}
