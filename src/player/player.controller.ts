import { Controller, Get, Param } from '@nestjs/common';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get(':lobbyId')
  findOne(@Param('lobbyId') id: string) {
    return this.playerService.findOne(+id);
  }
}
