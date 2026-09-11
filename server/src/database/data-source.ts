import { Logger } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { mkdirSync } from 'fs';
import mysql from 'mysql2/promise';

const logger = new Logger('Database');

export async function probeMysql(): Promise<boolean> {
  if (process.env.OFFLINE === '1') return false;
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'zhongxin123',
      connectTimeout: 2000,
    });
    // 不存在则建库
    const dbName = process.env.DB_NAME || 'microgrid';
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.end();
    return true;
  } catch (e: any) {
    try {
      await conn?.end();
    } catch {}
    logger.warn(
      `MySQL 不可达（${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}：${e?.code || e?.message}），降级 SQLite`,
    );
    return false;
  }
}

export async function getDbOptions(): Promise<TypeOrmModuleOptions> {
  const entities = [join(__dirname, '..', '**', '*.entity.{ts,js}')];
  const useMysql = await probeMysql();

  if (useMysql) {
    logger.log(`使用 MySQL 数据库 ${process.env.DB_NAME || 'microgrid'}`);
    return {
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'zhongxin123',
      database: process.env.DB_NAME || 'microgrid',
      entities,
      synchronize: true,
      charset: 'utf8mb4',
      timezone: '+08:00',
    };
  }

  const dir = join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  logger.warn(`使用 SQLite（${join(dir, 'microgrid.sqlite')}），生产请启动 MySQL`);
  return {
    type: 'better-sqlite3',
    database: join(dir, 'microgrid.sqlite'),
    entities,
    synchronize: true,
  };
}
