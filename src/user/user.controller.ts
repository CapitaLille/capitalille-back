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
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { idDto } from 'src/app.dto';
import { ApiBadRequestResponse } from '@nestjs/swagger';
@Controller('user')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('')
  async findOne(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.findOne(req.user.data.sub);
  }

  @Get('all')
  async findAll(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.findAll();
  }

  @Patch('')
  async update(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.update(req.user.data.sub, updateUserDto);
  }

  @Post('friends/:id')
  async addFriend(@Request() req, @Param('id') targetId: string) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.requestFriend(req.user.data.sub, targetId);
  }

  @Delete('')
  async remove(@Request() req, @Param('id') targetId: string) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.remove(targetId);
  }

  @Post('notification/:notif_id')
  async answerNotification(
    @Request() req,
    @Param('notif_id') notifId: string,
    answer: boolean,
  ) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.answerNotification(
      req.user.data.sub,
      notifId,
      answer,
    );
  }
}
