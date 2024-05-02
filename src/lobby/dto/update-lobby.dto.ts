import { PartialType } from '@nestjs/swagger';
import { CreateLobbyDto } from './create-lobby.dto';

export class UpdateLobbyDto extends PartialType(CreateLobbyDto) {
  owner: string;
  players: string[];
  map: string;
  turnSchedule: number;
  turnCount: number;
  turnCountMax: number;
  startTime: Date;
}
