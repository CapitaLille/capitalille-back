import { IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class idDto {
  @ApiProperty({
    description: 'The ID to convert.',
    type: String,
  })
  @IsNotEmpty({ message: 'ID cannot be empty' })
  id: string;
}
