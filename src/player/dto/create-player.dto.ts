import mongoose from 'mongoose';
import { Transaction } from '../player.schema';

export class CreatePlayerDto {
  user: mongoose.Types.ObjectId;
  lobby: mongoose.Types.ObjectId;
  houses: mongoose.Types.ObjectId[];
  money: number;
  rating: number;
  transactions: Transaction[];
  turnPlayed: boolean;
  actionPlayed: boolean;
}
