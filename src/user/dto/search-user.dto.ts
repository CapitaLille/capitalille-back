import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsMongoId,
  IsEnum,
  IsBooleanString,
  isString,
  IsString,
  IsNumberString,
} from 'class-validator';
import mongoose from 'mongoose';

export class SearchUserDto {
  // search string
  @ApiProperty({
    description: 'The search string.',
    type: String,
  })
  @IsDefined({ message: 'Search is required' })
  @IsString({ message: 'Search must be a string' })
  search: string;

  // isFrieds boolean
  @ApiProperty({
    description: 'The isFriends boolean.',
    type: Boolean,
  })
  @IsDefined({ message: 'isFriends is required' })
  @IsBooleanString({ message: 'isFriends must be a boolean' })
  inFriends: boolean;

  //page number, must be positive
  @ApiProperty({
    description: 'The page number.',
    type: Number,
  })
  @IsDefined({ message: 'Page is required' })
  //   @IsNumberString({ message: 'Page must be a number' })
  page: number;
}
