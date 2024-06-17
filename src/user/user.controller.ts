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
import { SearchUserDto } from './dto/search-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(AuthGuard)
  async find(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.findOne(req.user.data.sub);
  }

  @Post('searchUsers')
  @UseGuards(AuthGuard)
  async searchUsers(@Request() req, @Body() searchUserDto: SearchUserDto) {
    try {
      if (!req.user.data.sub) throw new BadRequestException('No UID provided');
      return await this.userService.searchUsers(
        searchUserDto.search,
        searchUserDto.page,
      );
    } catch (e) {
      return new BadRequestException(e.message);
    }
  }

  @Post('searchFriends')
  @UseGuards(AuthGuard)
  async searchFriends(@Request() req, @Body() searchUserDto: SearchUserDto) {
    try {
      if (!req.user.data.sub) throw new BadRequestException('No UID provided');
      return await this.userService.searchFriends(
        req.user.data.sub,
        searchUserDto.search,
        searchUserDto.page,
      );
    } catch (e) {
      return new BadRequestException(e.message);
    }
  }

  @Get('achievements')
  @UseGuards(AuthGuard)
  async getAchievements(@Request() req) {
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.getAchievements(req.user.data.sub);
  }

  @Post('multiple')
  @UseGuards(AuthGuard)
  async findMultiple(@Body() data: { ids: string[] }) {
    return await this.userService.findMultiple(data.ids);
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
    answer: number,
  ) {
    if (![0, 1].includes(answer))
      throw new BadRequestException('Invalid answer');
    if (!req.user.data.sub) throw new BadRequestException('No UID provided');
    return await this.userService.answerNotification(
      req.user.data.sub,
      notifId,
      answer === 1 ? true : false,
    );
  }
}
