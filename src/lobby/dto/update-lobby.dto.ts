import { PartialType } from '@nestjs/swagger';
import { CreateLobbyDto } from './create-lobby.dto';
import mongoose from 'mongoose';

export class UpdateLobbyDto extends PartialType(CreateLobbyDto) {
  players: mongoose.Types.ObjectId[];
}
