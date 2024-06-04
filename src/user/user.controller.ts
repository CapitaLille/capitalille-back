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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import { idDto } from 'src/app.dto';
import { ApiBadRequestResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Patch('pp')
  @UseInterceptors(FileInterceptor('pp'))
  async updatePp(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.updatePp(req.user.data.sub, file);
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

  @Get('friends')
  async getFriends(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.getFriends(req.user.data.sub);
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
