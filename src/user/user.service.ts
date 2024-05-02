import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import * as bcrypt from 'bcrypt';
import { bcryptConstants } from './constants';

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}

  async findOne(id: number) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user._id,
      email: user.email,
      nickname: user.nickname,
      lobbys: user.lobbys,
      credit: user.credit,
      pp: user.pp,
    };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    if (!(await this.userModel.findById(id))) {
      throw new NotFoundException('User not found');
    }
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        bcryptConstants.salt,
      );
    }
    await this.userModel.findByIdAndUpdate(id, updateUserDto);
    return HttpStatus.OK;
  }

  async remove(id: number) {
    if (!(await this.userModel.findById(id))) {
      throw new NotFoundException('User not found');
    }
    await this.userModel.findByIdAndDelete(id);
    return HttpStatus.OK;
  }
}
