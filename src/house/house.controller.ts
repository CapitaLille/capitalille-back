import { Controller, Get, Param } from '@nestjs/common';
import { HouseService } from './house.service';

@Controller('house')
export class HouseController {
  constructor(private readonly houseService: HouseService) {}

  @Get('')
  async findAll() {
    return await this.houseService.findAll();
  }
  @Get(':lobby')
  async findAllFromLobby(@Param('lobby') lobbyId: string) {
    return await this.houseService.findAllFromLobby(lobbyId);
  }
  @Get(':lobby:index')
  async findOne(
    @Param('lobby')
    lobbyId: string,
    @Param('index') index: string,
  ) {
    return await this.houseService.findOne(lobbyId, index);
  }
}
