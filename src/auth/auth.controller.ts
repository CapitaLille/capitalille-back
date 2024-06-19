import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from 'src/user/user.service';
import { MailerService } from 'src/mailer/mailer.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailerService: MailerService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  async register(@Body() createAuthDto: CreateAuthDto) {
    return await this.authService.register(createAuthDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  @Post('verify')
  async verify(@Body() body: { token: string }) {
    return await this.authService.verify(body.token);
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    const user = await this.userService.findOneByEmail(email);
    if (!user) {
      return new BadRequestException('User not found');
    }

    const token = await this.authService.generateResetPasswordToken(user);
    await this.mailerService.sendPasswordResetEmail(email, token);
  }

  @Post('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ) {
    try {
      const payload = await this.authService.validatePasswordResetToken(token);
      const email = payload.email;
      await this.userService.updateUserPassword(email, newPassword);
    } catch (e) {
      return new UnauthorizedException(e.message);
    }
  }
}
