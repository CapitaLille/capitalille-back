import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

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
  console.log(process.env.MONGODB_URL);
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
