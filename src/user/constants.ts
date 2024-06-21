import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Achievement } from './user.schema';

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

export const getUserLeague = (trophies: number | undefined) => {
  if (!trophies) return { actual: Leagues[0], next: Leagues[1] };
  if (trophies < 0) return { actual: Leagues[0], next: Leagues[1] };
  for (const league of Leagues) {
    if (trophies >= league.minTrophies && trophies < league.maxTrophies) {
      return { actual: league, next: Leagues[Leagues.indexOf(league) + 1] };
    }
  }
  return { actual: Leagues[Leagues.length - 1], next: undefined };
};

export const Leagues = [
  {
    league: Achievement.studentLeague,
    minTrophies: 0,
    maxTrophies: 1000,
  },
  {
    league: Achievement.,
    name: "Jeune dynamique",
    img: jeune,
  },
  {
    name: "Voleur",
    minTrophies: 1500,
    maxTrophies: 2000,
  },
  {
    name: "Rentier",
    minTrophies: 2000,
    maxTrophies: 2500,
  },
  {
    name: "Mafieux",
    minTrophies: 2500,
    maxTrophies: 3000,
  },
];