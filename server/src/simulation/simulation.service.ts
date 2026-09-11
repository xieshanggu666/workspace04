import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { WeatherData } from '../entities/weather.entity';
import { Tariff } from '../entities/tariff.entity';
import { Scenario } from '../entities/scenario.entity';
import { simulate } from './engine';
import { resolveScenarioDevices, ScenarioConfig } from './scenario-resolver';
import { SimDevice, SimulationInput, SimulationResult } from './types';

@Injectable()
export class SimulationService {
  constructor(
    @InjectRepository(Device) private deviceRepo: Repository<Device>,
    @InjectRepository(WeatherData) private weatherRepo: Repository<WeatherData>,
    @InjectRepository(Tariff) private tariffRepo: Repository<Tariff>,
    @InjectRepository(Scenario) private scenarioRepo: Repository<Scenario>,
  ) {}

  async buildInput(
    scenarioId?: number,
    weatherDate?: string,
    configOverride?: ScenarioConfig,
  ): Promise<SimulationInput & { scenarioName: string; scenarioId?: number }> {
    const baseDevices = await this.deviceRepo.find();
    const simBase: SimDevice[] = baseDevices.map((d) => ({
      id: d.id,
      type: d.type,
      name: d.name,
      x: d.x,
      y: d.y,
      status: d.status,
      faultMessage: d.faultMessage,
      params: d.params ?? {},
    }));

    let scenario: Scenario | null = null;
    let config: ScenarioConfig | undefined = configOverride;
    if (scenarioId) {
      scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
      if (scenario?.config && !configOverride) config = scenario.config as ScenarioConfig;
    }
    const devices = resolveScenarioDevices(simBase, config ?? null);

    const date =
      weatherDate ?? config?.weatherDate ?? (await this.latestWeatherDate());
    const weather = await this.weatherRepo.findOne({ where: { date } });
    if (!weather) throw new Error(`缺少 ${date} 的天气数据，请先导入天气`);

    const tariffEntity = (await this.tariffRepo.find({ take: 1 }))[0];
    const tariff = {
      periods: tariffEntity.periods,
      valleyPrice: tariffEntity.valleyPrice,
      flatPrice: tariffEntity.flatPrice,
      peakPrice: tariffEntity.peakPrice,
      sellPrice: tariffEntity.sellPrice,
      demandCharge: tariffEntity.demandCharge,
      ...(config?.tariffOverrides ?? {}),
    };

    return {
      date,
      devices,
      weather: {
        date: weather.date,
        irradiance: weather.irradiance,
        temperature: weather.temperature,
        cloudCover: weather.cloudCover,
      },
      tariff,
      scenarioName: scenario?.name ?? '当前运行方案',
      scenarioId: scenario?.id,
    };
  }

  async latestWeatherDate(): Promise<string> {
    const w = await this.weatherRepo
      .createQueryBuilder('w')
      .orderBy('w.date', 'DESC')
      .limit(1)
      .getOne();
    return w?.date ?? '';
  }

  async run(input: SimulationInput): Promise<SimulationResult> {
    // 引擎为确定性纯函数，未来扩展（多能流/随机场景）无需改动控制器
    return simulate(input);
  }
}
