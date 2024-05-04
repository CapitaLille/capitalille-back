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

@Controller('lobby')
@UseGuards(AuthGuard)
export class LobbyController {
  constructor(private readonly lobbyService: LobbyService) {}

  @Post()
  create(@Body() createLobbyDto: CreateLobbyDto, @Request() req) {
    return this.lobbyService.create(createLobbyDto, req.user.data.sub);
  }

  @Get()
  findAll() {
    return this.lobbyService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lobbyService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLobbyDto: UpdateLobbyDto) {
    return this.lobbyService.update(+id, updateLobbyDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lobbyService.remove(+id);
  }
}
