import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsArray,
  IsUrl,
  IsOptional,
  Matches,
} from 'class-validator';
import { CreateAuthDto } from './create-auth.dto';

export class UpdateAuthDto extends PartialType(CreateAuthDto) {
  @ApiProperty({
    description: 'The password of the user.',
    type: String,
  })
  @IsString({ message: 'Password must be a string' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password: string;

  @ApiProperty({
    description: 'The email of the user.',
    type: String,
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'The nickname of the user.',
    type: String,
  })
  @IsString({ message: 'Nickname must be a string' })
  nickname: string;

  @ApiProperty({
    description: 'An array of lobby IDs.',
    type: [String],
  })
  @IsArray({ message: 'Lobbys must be an array' })
  @IsString({ each: true, message: 'Each lobby ID must be a string' })
  lobbys: string[];

  @ApiProperty({
    description: 'The user credit.',
    type: Number,
  })
  @IsOptional()
  credit: number;

  @ApiProperty({
    description: 'The profile picture URL.',
    type: String,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  pp: string;
}
