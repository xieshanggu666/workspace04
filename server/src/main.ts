import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { seedIfEmpty } from './database/seed-runner';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: false,
    }),
  );

  // 首启动自动写入校园示例数据（MySQL / SQLite 均适用）
  const dataSource = app.get(DataSource);
  await seedIfEmpty(dataSource);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`微电网后端已启动: http://127.0.0.1:${port}/api`);
}
bootstrap();
