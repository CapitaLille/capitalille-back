import { Module, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/user.schema';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { MailerService } from 'src/mailer/mailer.service';
import { UserService } from 'src/user/user.service';
import { FilesAzureService } from 'src/fileazure/filesAzure.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConstantsService } from 'src/user/constants';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    ConstantsService,
    MailerService,
    UserService,
    FilesAzureService,
  ],
})
export class AuthModule {}
