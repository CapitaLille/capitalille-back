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
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClaimAchievementDto } from './dto/claim-achievement.dto';
import { MessageBody } from '@nestjs/websockets';
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(AuthGuard)
  async find(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.findOne(req.user.data.sub);
  }

  @Post('search')
  @UseGuards(AuthGuard)
  async findOne(
    @Request() req,
    @Body() data: { search: string; page: number; inFriends: boolean },
  ) {
    try {
      console.log(data)
      console.log(typeof(data.inFriends))
      if (!req.user.data.sub) throw new BadRequestException('No UID provided');
      if (data.inFriends === false) {
        return await this.userService.searchUsers(data.search, data.page);
      } else {
        return await this.userService.searchFriends(
          req.user.data.sub,
          data.search,
        );
      }
    } catch (e) {
      return new BadRequestException(e.message);
    }
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOneById(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Patch('')
  @UseGuards(AuthGuard)
  async update(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.update(req.user.data.sub, updateUserDto);
  }

  @Patch('achievements')
  @UseGuards(AuthGuard)
  async updateAchievements(
    @Request() req,
    @Body() achievements: ClaimAchievementDto,
  ) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.claimAchievement(
      req.user.data.sub,
      achievements.achievements,
      achievements.level,
    );
  }

  @Get('achievements')
  @UseGuards(AuthGuard)
  async getAchievements(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.getAchievements(req.user.data.sub);
  }

  @Patch('pp')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('pp'))
  async updatePp(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.updatePp(req.user.data.sub, file);
  }

  @Post('friends/:id')
  @UseGuards(AuthGuard)
  async addFriend(@Request() req, @Param('id') targetId: string) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.requestFriend(req.user.data.sub, targetId);
  }

  @Delete('')
  @UseGuards(AuthGuard)
  async remove(@Request() req, @Param('id') targetId: string) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.remove(targetId);
  }

  @Get('friends')
  @UseGuards(AuthGuard)
  async getFriends(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.getFriends(req.user.data.sub);
  }

  @Post('notification/:notif_id')
  @UseGuards(AuthGuard)
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
