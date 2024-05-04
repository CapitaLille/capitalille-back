import { PartialType } from '@nestjs/swagger';
import { CreatePlayerDto } from './create-player.dto';
import { Transaction } from '../player.schema';
import mongoose from 'mongoose';

export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {
  user: mongoose.Types.ObjectId;
  lobby: mongoose.Types.ObjectId;
  houses: mongoose.Types.ObjectId[];
  money: number;
  rating: number;
  transactions: Transaction[];
  turnPlayed: boolean;
  actionPlayed: boolean;
}
