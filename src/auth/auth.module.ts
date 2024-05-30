import { Module, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/user/user.schema';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { jwtConstants } from 'src/user/constants';
import { MailerService } from 'src/mailer/mailer.service';
import { UserService } from 'src/user/user.service';
import { FilesAzureService } from 'src/fileazure/filesAzure.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtService,
    MailerService,
    UserService,
    FilesAzureService,
  ],
})
export class AuthModule {}
