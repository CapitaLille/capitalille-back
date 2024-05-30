import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { CreateLobbyDto } from './dto/create-lobby.dto';
import { UpdateLobbyDto } from './dto/update-lobby.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import mongoose from 'mongoose';
import { idDto } from 'src/app.dto';
import { ObjectId } from 'mongodb';

@Controller('lobby')
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() createLobbyDto: CreateLobbyDto, @Request() req) {
    return await this.lobbyService.create(createLobbyDto, req.user.data.sub);
  }

  @Get()
  async findAll() {
    return await this.lobbyService.findAll();
  }

  @Get(':lobbyId')
  async findOne(@Param('lobbyId') lobbyId: string) {
    return await this.lobbyService.findOne(lobbyId);
  }

  @Delete(':lobbyId')
  @UseGuards(AuthGuard)
  async remove(@Param('lobbyId') lobbyId: string) {
    return await this.lobbyService.deleteLobby(lobbyId);
  }
}
