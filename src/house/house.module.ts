import { Module, forwardRef } from '@nestjs/common';
import { HouseService } from './house.service';
import { HouseController } from './house.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { HouseSchema } from './house.schema';
import { LobbySchema } from 'src/lobby/lobby.schema';
import { ServerGateway } from 'src/server/server.gateway';
import { ServerModule } from 'src/server/server.module';

@Module({
  controllers: [HouseController],
  providers: [HouseService],
  imports: [
    MongooseModule.forFeature([{ name: 'House', schema: HouseSchema }]),
    MongooseModule.forFeature([{ name: 'Lobby', schema: LobbySchema }]),
    forwardRef(() => ServerModule),
  ],
  exports: [HouseService],
})
export class HouseModule {}
