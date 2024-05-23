import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsMongoId,
  IsArray,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import mongoose from 'mongoose';
import { Transaction } from '../player.schema';

export class CreatePlayerDto {
  @ApiProperty({
    description: 'The user ID.',
    type: String,
  })
  @IsDefined({ message: 'user is required' })
  @IsMongoId({ message: 'user must be a valid MongoDB ObjectId' })
  user: string;

  @ApiProperty({
    description: 'The lobby ID.',
    type: String,
  })
  @IsDefined({ message: 'lobby is required' })
  @IsMongoId({ message: 'lobby must be a valid MongoDB ObjectId' })
  lobby: string;

  @ApiProperty({
    description: 'An array of house IDs.',
    type: [String],
  })
  @IsDefined({ message: 'houses is required' })
  @IsArray({ message: 'houses must be an array' })
  @IsMongoId({
    each: true,
    message: 'Each house ID must be a valid MongoDB ObjectId',
  })
  houses: string[];

  @ApiProperty({
    description: 'The amount of money.',
    type: Number,
  })
  @IsDefined({ message: 'money is required' })
  @IsNumber({}, { message: 'money must be a number' })
  money: number;

  @ApiProperty({
    description: 'The player rating.',
    type: Number,
  })
  @IsDefined({ message: 'rating is required' })
  @IsNumber({}, { message: 'rating must be a number' })
  rating: number;

  @ApiProperty({
    description: 'An array of transactions.',
    type: [],
  })
  @IsDefined({ message: 'transactions is required' })
  @IsArray({ message: 'transactions must be an array' })
  @ValidateNested({ each: true })
  @Type(() => Transaction)
  transactions: Transaction[];

  @ApiProperty({
    description: 'Indicates if the turn has been played.',
    type: Boolean,
  })
  @IsDefined({ message: 'turnPlayed is required' })
  @IsBoolean({ message: 'turnPlayed must be a boolean' })
  turnPlayed: boolean;

  @ApiProperty({
    description: 'Indicates if the action has been played.',
    type: Boolean,
  })
  @IsDefined({ message: 'actionPlayed is required' })
  @IsBoolean({ message: 'actionPlayed must be a boolean' })
  actionPlayed: boolean;
}
