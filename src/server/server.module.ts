import { Module } from '@nestjs/common';
import { ServerGateway } from './server.gateway';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { jwtConstants } from 'src/user/constants';
import { UserService } from 'src/user/user.service';
import { UserModule } from 'src/user/user.module';
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

@Module({
  providers: [
    ServerService,
    ServerGateway,
    JwtService,
    UserService,
    LobbyService,
    PlayerService,
    MapService,
    HouseService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    MongooseModule.forFeature([{ name: 'Map', schema: MapSchema }]),
    MongooseModule.forFeature([{ name: 'House', schema: HouseSchema }]),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
    }),
  ],
})
export class ServerModule {}
