import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { HouseService } from './house.service';

@Controller('house')
export class HouseController {
  constructor(private readonly houseService: HouseService) {}

  @Get('lobby/index')
  async findOne(@Param('lobby') lobby: string, @Param('index') index: string) {
    return await this.houseService.findOne(+lobby, +index);
  }

  @Get('lobby')
  async findAll(@Param('lobby') lobby: string) {
    return await this.houseService.findAll(+lobby);
  }
}
