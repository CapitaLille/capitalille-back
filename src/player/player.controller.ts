import { Controller, Get, Param } from '@nestjs/common';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get(':lobbyId')
  async findPlayersFromLobby(@Param('lobbyId') id: string) {
    return await this.playerService.findPlayersFromLobby(+id);
  }

  @Get('')
  async findAll() {
    return await this.playerService.findAll();
  }
}
