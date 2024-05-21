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

@Module({
  imports: [
    UserModule,
    AuthModule,
    ConfigModule.forRoot({
      envFilePath: ['.env.dev', '.env.prod'],
      isGlobal: true,
      cache: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URL),
    LobbyModule,
    PlayerModule,
    MapModule,
    HouseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
