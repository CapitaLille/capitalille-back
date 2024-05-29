import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { customAlphabet } from 'nanoid';
import { ValidationPipe } from '@nestjs/common';

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

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: 'http://localhost:3001',
    methods: 'GET',
    allowedHeaders: 'Content-Type, Accept',
  });
  await app.listen(3000);
}
bootstrap();
