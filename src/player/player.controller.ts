import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PlayerService } from './player.service';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get(':lobbyId')
  @UseGuards(AuthGuard)
  async findAllFromLobby(@Param('lobbyId') lobbyId: string) {
    return await this.playerService.findAllFromLobby(lobbyId);
  }

  @Get('')
  async findAll() {
    return await this.playerService.findAll();
  }
}
