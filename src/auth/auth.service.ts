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
import { ConstantsService } from 'src/user/constants';
import { LoginDto } from './dto/login.dto';
import { Doc } from 'src/server/server.type';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    @InjectModel('User') private readonly userModel: Model<User>,
    private readonly constantsService: ConstantsService,
  ) {}

  async register(createAuthDto: CreateAuthDto) {
    const foundUser = await this.userModel.findOne({
      email: createAuthDto.email,
    });

    if (foundUser) {
      throw new BadRequestException('Mail already used');
    }

    const salt = Number(this.constantsService.bcryptConstants.salt);
    console.log(salt);
    createAuthDto.password = await bcrypt.hash(createAuthDto.password, salt);

    const user = await this.userModel.create(createAuthDto);
    const token = await this.generateTokens(user);
    return token;
  }

  async login(loginDto: LoginDto) {
    const foundUser = await this.userModel
      .findOne({ email: loginDto.email })
      .select('+password');
    if (!foundUser) {
      throw new NotFoundException('User not found');
    }
    const valid = await bcrypt.compare(loginDto.password, foundUser?.password);
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
        secret: this.constantsService.jwtConstants.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const foundUser = await this.userModel.findOne({ email: user.data.email });
    console.log('foundUser', foundUser);
    if (foundUser !== null) {
      return await this.generateTokens({
        ...user.data,
        _id: foundUser._id.toString(),
      });
    } else {
      throw new UnauthorizedException("Can't generate token");
    }
  }

  async generateTokens(
    user: Doc<User>,
  ): Promise<{ access: string; verify: string }> {
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
        { secret: this.constantsService.jwtConstants.secret },
      ),
      verify: await this.jwt.signAsync(
        {
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          data: payload,
        },
        { secret: this.constantsService.jwtConstants.secret },
      ),
    };
  }

  async generateResetPasswordToken(user: Doc<User>): Promise<string> {
    const payload = {
      email: user.email,
    };
    return await this.jwt.signAsync(
      {
        exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
        data: payload,
      },
      { secret: this.constantsService.jwtConstants.secret },
    );
  }

  async validatePasswordResetToken(token: string): Promise<{ email: string }> {
    return await this.jwt
      .verifyAsync(token, {
        secret: this.constantsService.jwtConstants.secret,
      })
      .catch((err) => {
        throw new UnauthorizedException(
          "Le token n'est pas valide, ou a expiré.",
        );
      })
      .then((data) => {
        return data.data;
      });
  }
}
