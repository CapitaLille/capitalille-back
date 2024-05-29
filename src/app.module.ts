import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { LobbyModule } from './lobby/lobby.module';
import { PlayerModule } from './player/player.module';
import { MapModule } from './map/map.module';
import { HouseModule } from './house/house.module';
import { ServerModule } from './server/server.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.dev', '.env.prod'],
      isGlobal: true,
      cache: true,
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URL),
    UserModule,
    AuthModule,
    LobbyModule,
    PlayerModule,
    MapModule,
    HouseModule,
    ServerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
