import { Controller, Get, Param } from '@nestjs/common';
import { PlayerService } from './player.service';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get(':lobbyId')
  async findAllFromLobby(@Param('lobbyId') lobbyId: string) {
    return await this.playerService.findAllFromLobby(lobbyId);
  }

  @Get('')
  async findAll() {
    return await this.playerService.findAll();
  }
}
