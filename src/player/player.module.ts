import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from 'src/user/user.schema';
import { Player, PlayerSchema } from './player.schema';
import { ServerService } from 'src/server/server.service';
import { ServerModule } from 'src/server/server.module';

@Module({
  controllers: [PlayerController],
  providers: [PlayerService],
  imports: [
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    ServerModule,
  ],
  exports: [PlayerService],
})
export class PlayerModule {}
