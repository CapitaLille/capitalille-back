import { Module, forwardRef } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/user.schema';
import { Player, PlayerSchema } from './player.schema';
import { ServerService } from 'src/server/server.service';
import { ServerModule } from 'src/server/server.module';
import { UserService } from 'src/user/user.service';
import { FilesAzureService } from 'src/fileazure/filesAzure.service';

@Module({
  controllers: [PlayerController],
  providers: [PlayerService, UserService, FilesAzureService],
  imports: [
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    ServerModule,
  ],
  exports: [PlayerService],
})
export class PlayerModule {}
