import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConstantsService {
  jwtConstants: { secret: string };
  bcryptConstants: { salt: number };

  constructor(private configService: ConfigService) {
    // Initialize jwtConstants and bcryptConstants in the constructor
    this.jwtConstants = {
      secret: this.configService.get<string>('JWT_SECRET'),
    };
    this.bcryptConstants = {
      salt: this.configService.get<number>('BCRYPT_SALT'),
    };
  }
}

export const lobbyConstants = {
  starting: {
    money: 500000,
    rating: 2.5,
  },
  restrictions: {
    maxScheduledTurn: 3600 * 24,
    minScheduledTurn: 30,
    maxTurnCount: 2000,
    minTurnCount: 10,
  },
};
