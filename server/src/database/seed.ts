/** 命令行重灌示例数据：npm run seed（server 工作区） */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDbOptions } from './data-source';
import { runSeed } from './seed-runner';

async function main() {
  const options = (await getDbOptions()) as any;
  const dataSource = new DataSource({ ...options, synchronize: true });
  await dataSource.initialize();
  await runSeed(dataSource);
  await dataSource.destroy();
  console.log('种子数据完成');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
