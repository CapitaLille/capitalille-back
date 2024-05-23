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

export class LoginDto {
  @ApiProperty({
    description: 'The password of the user.',
    type: String,
  })
  @IsDefined({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  // @Matches(
  //   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  //   {
  //     message:
  //       'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character',
  //   },
  // )
  password: string;

  @ApiProperty({
    description: 'The email of the user.',
    type: String,
  })
  @IsDefined({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;
}
