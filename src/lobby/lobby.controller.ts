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
    return await this.lobbyService.createPrivate(
      createLobbyDto,
      req.user.data.sub,
    );
  }

  @Get('joined')
  @UseGuards(AuthGuard)
  async findAllJoined(@Request() req) {
    return await this.lobbyService.findAllFromUser(req.user.data.sub);
  }

  @Get('public')
  @UseGuards(AuthGuard)
  async findPublicNotJoined(@Request() req, @Body() page: number) {
    if (!page) page = 0;
    return await this.lobbyService.findPublic(page);
  }

  @Get(':lobbyId')
  async findOne(@Param('lobbyId') lobbyId: string) {
    return await this.lobbyService.findOne(lobbyId);
  }

  @Post('multiple')
  @UseGuards(AuthGuard)
  async findMultiple(@Body() data: { ids: string[] }) {
    return await this.lobbyService.findMultiple(data.ids);
  }
}
