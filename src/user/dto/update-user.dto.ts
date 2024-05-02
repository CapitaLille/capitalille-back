import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  email: string;
  password: string;
  nickname: string;
  lobbys: string[];
  credit: string[];
  pp: string;
}
