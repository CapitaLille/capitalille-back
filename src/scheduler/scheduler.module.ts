import { Module } from '@nestjs/common';
import { SchedulerService } from '../server/scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { ServerService } from 'src/server/server.service';
import { ServerGateway } from 'src/server/server.gateway';
import { JwtService } from '@nestjs/jwt';
import { HouseService } from 'src/house/house.service';
import { LobbyService } from 'src/lobby/lobby.service';
import { MapService } from 'src/map/map.service';
import { PlayerService } from 'src/player/player.service';
import { UserService } from 'src/user/user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from 'src/user/user.schema';

@Module({
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    ServerService,
    ServerGateway,
    JwtService,
    UserService,
    LobbyService,
    PlayerService,
    MapService,
    HouseService,
  ],
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }])],
})
export class SchedulerModule {}
