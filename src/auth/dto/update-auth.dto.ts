import { PartialType } from '@nestjs/mapped-types';
import { CreateAuthDto } from './create-auth.dto';

export class UpdateAuthDto extends PartialType(CreateAuthDto) {
  password: string;
  email: string;
  nickname: string;
  lobbys: string[];
  credit: number;
  pp: string;
}
