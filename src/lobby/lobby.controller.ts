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
    console.log('Create lobby', createLobbyDto, req.user.data.sub);
    return await this.lobbyService.create(createLobbyDto, req.user.data.sub);
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(@Request() req, @Body() page: number) {
    if (!page) page = 0;
    return await this.lobbyService.findAllFromUser(req.user.data.sub, page);
  }

  @Get('present/:lobbyId')
  @UseGuards(AuthGuard)
  async present(@Param('lobbyId') lobbyId: string, @Request() req) {
    return await this.lobbyService.present(lobbyId);
  }

  @Get('presents')
  @UseGuards(AuthGuard)
  async presents(@Request() req) {
    return await this.lobbyService.presents(req.user.data.sub);
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

  @Post('multiple')
  @UseGuards(AuthGuard)
  async findMultiple(@Body() data: { ids: string[] }) {
    return await this.lobbyService.findMultiple(data.ids);
  }
}
