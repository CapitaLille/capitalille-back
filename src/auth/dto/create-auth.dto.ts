import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsString,
  IsEmail,
  IsArray,
  IsUrl,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class CreateAuthDto {
  @ApiProperty({
    description: 'The password of the user.',
    type: String,
  })
  @IsDefined({ message: 'Password is required' })
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
  @IsDefined({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    description: 'The nickname of the user.',
    type: String,
  })
  @IsDefined({ message: 'Nickname is required' })
  @IsString({ message: 'Nickname must be a string' })
  @Length(1, 20, {
    message: 'Nickname must be between 1 and 20 characters long',
  })
  nickname: string;

  @ApiProperty({
    description: 'An array of lobby IDs.',
    type: [String],
  })
  @IsDefined({ message: 'Lobbys is required' })
  @IsArray({ message: 'Lobbys must be an array' })
  @IsString({ each: true, message: 'Each lobby ID must be a string' })
  lobbys: string[];

  @ApiProperty({
    description: 'The profile picture URL.',
    type: String,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  pp: string;
}
