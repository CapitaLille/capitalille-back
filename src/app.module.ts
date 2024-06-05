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
import { FilesAzureService } from './fileazure/filesAzure.service';
import { MailerService } from './mailer/mailer.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available globally
      envFilePath: '.env', // Load from .env file
    }),
    MongooseModule.forRoot(
      'mongodb+srv://adrienvrh2:6kiI2IWc87LV9G6d@cluster0.sfi6lfh.mongodb.net/capitalille_dev',
    ),
    UserModule,
    AuthModule,
    LobbyModule,
    PlayerModule,
    MapModule,
    HouseModule,
    ServerModule,
  ],
  controllers: [AppController],
  providers: [AppService, FilesAzureService, MailerService],
})
export class AppModule {}
