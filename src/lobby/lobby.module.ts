import { Module } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { LobbyController } from './lobby.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { LobbySchema } from './lobby.schema';
import { UserSchema } from 'src/user/user.schema';
import { PlayerService } from 'src/player/player.service';
import { UserService } from 'src/user/user.service';
import { PlayerSchema } from 'src/player/player.schema';
import { MapSchema } from 'src/map/map.schema';
import { HouseService } from 'src/house/house.service';
import { MapService } from 'src/map/map.service';
import { HouseSchema } from 'src/house/house.schema';

@Module({
  controllers: [LobbyController],
  providers: [
    LobbyService,
    PlayerService,
    UserService,
    HouseService,
    MapService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    MongooseModule.forFeature([{ name: 'Map', schema: MapSchema }]),
    MongooseModule.forFeature([{ name: 'House', schema: HouseSchema }]),
  ],
})
export class LobbyModule {}
