import { Module, forwardRef } from '@nestjs/common';
import { HouseService } from './house.service';
import { HouseController } from './house.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { HouseSchema } from './house.schema';
import { LobbySchema } from 'src/lobby/lobby.schema';
import { ServerGateway } from 'src/server/server.gateway';
import { ServerModule } from 'src/server/server.module';
import { MapService } from 'src/map/map.service';
import { MapSchema } from 'src/map/map.schema';

@Module({
  controllers: [HouseController],
  providers: [HouseService, MapService],
  imports: [
    MongooseModule.forFeature([{ name: 'House', schema: HouseSchema }]),
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    MongooseModule.forFeature([{ name: 'Map', schema: MapSchema }]),
    forwardRef(() => ServerModule),
  ],
  exports: [HouseService],
})
export class HouseModule {}
