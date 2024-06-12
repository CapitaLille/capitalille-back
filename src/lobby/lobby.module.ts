import { Module } from '@nestjs/common';
import { LobbyService } from './lobby.service';
import { LobbyController } from './lobby.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { LobbySchema } from './lobby.schema';
import { PlayerSchema } from 'src/player/player.schema';
import { PlayerModule } from 'src/player/player.module';
import { UserModule } from 'src/user/user.module';
import { HouseModule } from 'src/house/house.module';
import { MapModule } from 'src/map/map.module';
import { JwtService } from '@nestjs/jwt';
import { ConstantsService } from 'src/user/constants';

@Module({
  controllers: [LobbyController],
  providers: [LobbyService, JwtService, ConstantsService],
  imports: [
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    UserModule,
    PlayerModule,
    HouseModule,
    MapModule,
  ],
  exports: [LobbyService],
})
export class LobbyModule {}
