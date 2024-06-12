import { Module } from '@nestjs/common';
import { ServerGateway } from './server.gateway';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from 'src/user/user.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import { LobbySchema } from 'src/lobby/lobby.schema';
import { PlayerService } from 'src/player/player.service';
import { MapService } from 'src/map/map.service';
import { HouseService } from 'src/house/house.service';
import { PlayerSchema } from 'src/player/player.schema';
import { MapSchema } from 'src/map/map.schema';
import { HouseSchema } from 'src/house/house.schema';
import { ServerService } from './server.service';
import { SchedulerService } from './scheduler.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { FilesAzureService } from 'src/fileazure/filesAzure.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConstantsService } from 'src/user/constants';
import { ExecutionManagementService } from './execution.service';

@Module({
  providers: [
    ServerService,
    ServerGateway,
    JwtService,
    UserService,
    ConstantsService,
    LobbyService,
    PlayerService,
    SchedulerService,
    SchedulerRegistry,
    MapService,
    HouseService,
    FilesAzureService,
    ExecutionManagementService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    MongooseModule.forFeature([{ name: 'Map', schema: MapSchema }]),
    MongooseModule.forFeature([{ name: 'House', schema: HouseSchema }]),
    ServerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class ServerModule {}
