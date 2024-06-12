import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { JwtService } from '@nestjs/jwt';
import { LobbyService } from 'src/lobby/lobby.service';
import { LobbySchema } from 'src/lobby/lobby.schema';
import { LobbyModule } from 'src/lobby/lobby.module';
import { PlayerModule } from 'src/player/player.module';
import { MapSchema } from 'src/map/map.schema';
import { MapModule } from 'src/map/map.module';
import { HouseService } from 'src/house/house.service';
import { HouseModule } from 'src/house/house.module';
import { FilesAzureService } from 'src/fileazure/filesAzure.service';
import { ConfigService } from '@nestjs/config';
import { ConstantsService } from './constants';

@Module({
  controllers: [UserController],
  providers: [
    JwtService,
    LobbyService,
    UserService,
    FilesAzureService,
    ConstantsService,
    ConfigService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    PlayerModule,
    MapModule,
    HouseModule,
  ],
  exports: [UserService],
})
export class UserModule {}
