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

  @Get('all')
  async findAll(@Request() req) {
    if (!req.user.data.sub) throw new Error('No UID provided');
    return await this.userService.findAll();
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

  @Post('notification/:notif_id')
  async answerNotification(
    @Request() req,
    @Param('notif_id') notifId: string,
    answer: boolean,
  ) {
    if (!req.user.data.sub) throw new Error('No UID provided');
    return await this.userService.answerNotification(
      req.user.data.sub,
      notifId,
      answer,
    );
  }
}
