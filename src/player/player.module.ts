import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User } from 'src/user/user.schema';
import { Player, PlayerSchema } from './player.schema';

@Module({
  controllers: [PlayerController],
  providers: [PlayerService],
  imports: [
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
  ],
  exports: [PlayerService],
})
export class PlayerModule {}
