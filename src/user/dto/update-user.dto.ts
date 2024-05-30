import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  email: string;
  nickname: string;
  lobbys: string[];
  credit: number;
  pp: string;
}
