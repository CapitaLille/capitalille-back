import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { customAlphabet } from 'nanoid';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // Determine the environment
  const env =
    process.env.ENV_PRODUCTION === 'true' ? 'production' : 'development';

  // Load environment variables based on the environment
  if (env === 'production') {
    dotenv.config({ path: '.env.prod' });
  } else {
    dotenv.config({ path: '.env.dev' });
  }

  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ&';
  const nanoid = customAlphabet(alphabet, 6);
  const port = process.env.PORT || 8080;
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: '*',
    methods: '*',
  });
  app.useGlobalPipes(new ValidationPipe());
  // app.enableCors({
  //   origin: '*',
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   preflightContinue: false,
  //   optionsSuccessStatus: 204,
  // });
  await app.listen(3000); // Bind to 0.0.0.0
}
bootstrap();
