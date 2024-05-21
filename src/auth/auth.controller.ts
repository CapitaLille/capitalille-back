import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() createAuthDto: CreateAuthDto) {
    return await this.authService.register(createAuthDto);
  }

  @Post('login')
  async login(@Body() createAuthDto: CreateAuthDto) {
    return await this.authService.login(createAuthDto);
  }

  @Post('verify')
  async verify(@Body() body: { token: string }) {
    return await this.authService.verify(body.token);
  }
}
