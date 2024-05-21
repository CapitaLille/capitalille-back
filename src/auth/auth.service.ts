import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { UserService } from 'src/user/user.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/user/user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { bcryptConstants, jwtConstants } from 'src/user/constants';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    @InjectModel('User') private readonly userModel: Model<User>,
  ) {}

  async register(createAuthDto: CreateAuthDto) {
    const foundUser = await this.userModel.findOne({
      email: createAuthDto.email,
    });
    if (foundUser) {
      throw new BadRequestException('Mail already used');
    }

    createAuthDto.password = await bcrypt.hash(
      createAuthDto.password,
      bcryptConstants.salt,
    );

    const user = await this.userModel.create(createAuthDto);
    const token = await this.generateTokens(user);
    return token;
  }

  async login(data: { email: string; password: string }) {
    const foundUser = await this.userModel.findOne({ email: data.email });
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    const valid = await bcrypt.compare(data.password, foundUser?.password);
    if (!valid) {
      throw new HttpException('Wrong password', HttpStatus.FORBIDDEN);
    } else {
      return await this.generateTokens(foundUser);
    }
  }

  async verify(token: string) {
    let user;
    try {
      user = await this.jwt.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const foundUser = await this.userModel.findOne({ email: user.data.email });
    if (foundUser !== null) {
      return await this.generateTokens({
        ...user.data,
        _id: foundUser._id.toString(),
      });
    } else {
      throw new UnauthorizedException("Can't generate token");
    }
  }

  private async generateTokens(user) {
    const payload = {
      sub: user._id,
      email: user.email,
      nickname: user.nickname,
      pp: user.pp,
    };
    return {
      access: await this.jwt.signAsync(
        {
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          data: payload,
        },
        { secret: jwtConstants.secret },
      ),
      verify: await this.jwt.signAsync(
        {
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          data: payload,
        },
        { secret: jwtConstants.secret },
      ),
    };
  }
}
