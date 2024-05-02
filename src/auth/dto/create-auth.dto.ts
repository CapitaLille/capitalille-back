import { ApiProperty } from '@nestjs/swagger';

export class CreateAuthDto {
  @ApiProperty()
  password: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty()
  lobbys: string[];

  @ApiProperty()
  credit: number;

  @ApiProperty()
  pp: string;
}
