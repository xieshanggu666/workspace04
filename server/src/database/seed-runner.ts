import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Device } from '../entities/device.entity';
import { WeatherData } from '../entities/weather.entity';
import { Tariff } from '../entities/tariff.entity';
import { Scenario } from '../entities/scenario.entity';
import { Alarm } from '../entities/alarm.entity';
import { User } from '../entities/user.entity';
import {
  sampleDevices,
  sampleScenarios,
  sampleTariff,
  sampleUsers,
  sampleWeather,
} from './sample-data';
import { simulate } from '../simulation/engine';
import { resolveScenarioDevices } from '../simulation/scenario-resolver';

const logger = new Logger('Seed');

export async function seedIfEmpty(dataSource: DataSource, force = false) {
  const deviceRepo = dataSource.getRepository(Device);
  const count = await deviceRepo.count();
  if (count > 0 && !force) {
    logger.log('示例数据已存在，跳过');
    return;
  }
  await runSeed(dataSource);
}

export async function runSeed(dataSource: DataSource) {
  logger.log('开始写入校园示例数据...');

  const deviceRepo = dataSource.getRepository(Device);
  const weatherRepo = dataSource.getRepository(WeatherData);
  const tariffRepo = dataSource.getRepository(Tariff);
  const scenarioRepo = dataSource.getRepository(Scenario);
  const alarmRepo = dataSource.getRepository(Alarm);
  const userRepo = dataSource.getRepository(User);

  // 清空（force 重灌时）
  await Promise.all(
    [alarmRepo, scenarioRepo, weatherRepo, tariffRepo, deviceRepo, userRepo].map((r) =>
      r.clear(),
    ),
  );

  const devices = await deviceRepo.save(
    sampleDevices().map((d) => deviceRepo.create({ status: 'normal', faultMessage: '', ...d })),
  );
  logger.log(`设备 ${devices.length} 台`);

  await weatherRepo.save(
    sampleWeather().map((w) =>
      weatherRepo.create({
        date: w.date,
        label: w.label,
        irradiance: w.irradiance,
        temperature: w.temperature,
        cloudCover: w.cloudCover,
      }),
    ),
  );
  logger.log('天气 3 天（晴 / 多云 / 高温）');

  await tariffRepo.save(tariffRepo.create(sampleTariff() as any));

  await userRepo.save(sampleUsers().map((u) => userRepo.create(u)));

  await scenarioRepo.save(sampleScenarios() as any[]);
  logger.log('容量方案 4 个（基线 + 3 个规划方案）');

  // 基于高温日基线推演，生成供回放的运行告警
  const weatherEntity = await weatherRepo.findOne({ where: { date: '2026-09-10' } });
  const tariffEntity = (await tariffRepo.find())[0];
  const simDevices = devices.map((d) => ({
    id: d.id,
    type: d.type,
    name: d.name,
    status: d.status,
    faultMessage: d.faultMessage,
    params: d.params ?? {},
  }));
  const result = simulate({
    date: '2026-09-10',
    devices: simDevices,
    weather: {
      date: weatherEntity!.date,
      irradiance: weatherEntity!.irradiance,
      temperature: weatherEntity!.temperature,
      cloudCover: weatherEntity!.cloudCover,
    },
    tariff: {
      periods: tariffEntity.periods,
      valleyPrice: tariffEntity.valleyPrice,
      flatPrice: tariffEntity.flatPrice,
      peakPrice: tariffEntity.peakPrice,
      sellPrice: tariffEntity.sellPrice,
      demandCharge: tariffEntity.demandCharge,
    },
  });
  await alarmRepo.save(
    result.alarms.map((a) =>
      alarmRepo.create({
        ...a,
        scenario: 'baseline',
        date: '2026-09-10',
        status: 'active',
      }),
    ),
  );
  logger.log(`基线运行告警 ${result.alarms.length} 条`);

  // 防止未使用告警
  void resolveScenarioDevices;

  logger.log('示例数据写入完成');
}
