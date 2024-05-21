import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsMongoId, IsEnum } from 'class-validator';
import mongoose from 'mongoose';

export class CreatePushDto {
  @ApiProperty({
    description: 'The ID of the sender.',
    type: String,
  })
  @IsDefined({ message: 'From is required' })
  @IsMongoId({ message: 'From must be a valid MongoDB ObjectId' })
  from: mongoose.Types.ObjectId;

  @ApiProperty({
    description: 'The ID of the receiver.',
    type: String,
  })
  @IsDefined({ message: 'To is required' })
  @IsMongoId({ message: 'To must be a valid MongoDB ObjectId' })
  to: mongoose.Types.ObjectId;

  @ApiProperty({
    description: 'The ID of the attached resource.',
    type: String,
  })
  @IsDefined({ message: 'Attached is required' })
  @IsMongoId({ message: 'Attached must be a valid MongoDB ObjectId' })
  attached: mongoose.Types.ObjectId;

  @ApiProperty({
    description: 'The type of push notification.',
    enum: [
      'gameInvite',
      'gameStart',
      'friendRequest',
      'gameEnd',
      'gameTurn',
      'gameAction',
      'gameMessage',
    ],
  })
  @IsDefined({ message: 'Type is required' })
  @IsEnum(
    [
      'gameInvite',
      'gameStart',
      'gameEnd',
      'friendRequest',
      'gameTurn',
      'gameAction',
      'gameMessage',
    ],
    {
      message:
        'Type must be one of gameInvite, gameStart, gameEnd, gameTurn, gameAction, gameMessage',
    },
  )
  type:
    | 'gameInvite'
    | 'gameStart'
    | 'gameEnd'
    | 'friendRequest'
    | 'gameTurn'
    | 'gameAction'
    | 'gameMessage';
}
