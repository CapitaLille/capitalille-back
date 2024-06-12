import { ConfigService } from '@nestjs/config';

export class ConstantsService {
  constructor(private configService: ConfigService) {}

  get jwtConstants() {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
    };
  }

  get bcryptConstants() {
    return {
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
    maxScheduledTurn: 3600 * 24 * 1000,
    minScheduledTurn: 30 * 1000,
    maxTurnCount: 2000,
    minTurnCount: 10,
  },
};
