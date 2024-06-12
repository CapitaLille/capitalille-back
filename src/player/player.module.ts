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
import { ConstantsService } from 'src/user/constants';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [PlayerController],
  providers: [
    PlayerService,
    UserService,
    FilesAzureService,
    ConstantsService,
    JwtService,
  ],
  imports: [
    MongooseModule.forFeature([{ name: 'Player', schema: PlayerSchema }]),
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    ServerModule,
  ],
  exports: [PlayerService],
})
export class PlayerModule {}
