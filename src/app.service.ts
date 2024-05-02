import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return "Voici l'API de CapitaLille.";
  }
}
