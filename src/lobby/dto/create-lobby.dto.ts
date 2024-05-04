import mongoose from 'mongoose';

export class CreateLobbyDto {
  players: mongoose.Types.ObjectId[];
  map: mongoose.Types.ObjectId;
  turnSchedule: number;
  turnCountMax: number;
  code: boolean;
}
