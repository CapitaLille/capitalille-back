import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { customAlphabet } from 'nanoid';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  dotenv.config();
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ&';
  const nanoid = customAlphabet(alphabet, 6);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Servir les fichiers statiques
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Rediriger toutes les autres routes vers index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
      res.sendFile(join(__dirname, '..', 'public', 'index.html'));
    } else {
      next();
    }
  });
  app.enableCors({
    origin: '*',
    methods: '*',
  });
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(8080);
}
bootstrap();
