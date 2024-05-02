import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    private userService: UserService,
    private jwt: JwtService,
  ) {}

  create(createUserDto: CreateUserDto) {
    const user = this.userService.create(createUserDto);
    return user;
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    const user = this.userService.findOne(id);
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
