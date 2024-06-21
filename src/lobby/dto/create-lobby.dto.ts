import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsArray,
  IsMongoId,
  IsInt,
  IsBoolean,
  IsNumber,
  IsNumberString,
  IsBooleanString,
  ArrayUnique,
} from 'class-validator';
import mongoose from 'mongoose';

export class CreateLobbyDto {
  @ApiProperty({
    description: 'An array of user IDs.',
    type: [String],
  })
  @IsDefined({ message: 'users is required' })
  @IsArray({ message: 'users must be an array' })
  @IsMongoId({
    each: true,
    message: 'Each user ID must be a valid MongoDB ObjectId',
  })
  @ArrayUnique({ message: 'Users must not contain duplicate IDs' })
  users: string[];

  @ApiProperty({
    description: 'The map ID.',
    type: String,
  })
  @IsDefined({ message: 'map is required' })
  @IsMongoId({ message: 'map must be a valid MongoDB ObjectId' })
  map: string;

  @ApiProperty({
    description: 'The turn schedule in milliseconds.',
    type: Number,
  })
  @IsDefined({ message: 'turnSchedule is required' })
  @IsNumberString({}, { message: 'turnSchedule must be a number' })
  turnSchedule: number;

  @ApiProperty({
    description: 'The maximum number of turns.',
    type: Number,
  })
  @IsDefined({ message: 'turnCountMax is required' })
  @IsNumberString({}, { message: 'turnCountMax must be a number' })
  turnCountMax: number;
}
