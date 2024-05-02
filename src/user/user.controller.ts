import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('')
  async findOne(@Request() req) {
    if (!req.user.data.sub) throw new Error('No UID provided');
    return await this.userService.findOne(req.user.data.sub);
  }

  @Patch('')
  async update(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    if (!req.user.data.sub) throw new Error('No UID provided');
    return await this.userService.update(req.user.data.sub, updateUserDto);
  }

  @Delete('')
  async remove(@Request() req, @Param('id') id: string) {
    if (!req.user.data.sub) throw new Error('No UID provided');
    return await this.userService.remove(+id);
  }
}
