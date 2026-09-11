import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeatherData } from '../entities/weather.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { CacheService } from '../cache/cache.service';

interface ImportPayload {
  date: string;
  label?: string;
  irradiance: number[];
  temperature: number[];
  cloudCover: number[];
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('weather')
export class WeatherController {
  constructor(
    @InjectRepository(WeatherData) private repo: Repository<WeatherData>,
    private cache: CacheService,
  ) {}

  @Get()
  list() {
    return this.repo.find({ order: { date: 'DESC' } });
  }

  @Get(':date')
  get(@Param('date') date: string) {
    return this.repo.findOne({ where: { date } });
  }

  /** 导入一天 24 小时的辐照/温度/云量（数组长度必须为 24） */
  @Post('import')
  @Roles('manager')
  async import(@Body() body: ImportPayload) {
    for (const key of ['irradiance', 'temperature', 'cloudCover'] as const) {
      if (!Array.isArray(body[key]) || body[key].length !== 24) {
        throw new Error(`${key} 必须是长度 24 的逐时数组`);
      }
    }
    const exists = await this.repo.findOne({ where: { date: body.date } });
    if (exists) {
      exists.label = body.label ?? exists.label;
      exists.irradiance = body.irradiance;
      exists.temperature = body.temperature;
      exists.cloudCover = body.cloudCover;
      await this.repo.save(exists);
      return exists;
    }
    const saved = await this.repo.save(
      this.repo.create({
        date: body.date,
        label: body.label ?? '导入天气',
        irradiance: body.irradiance,
        temperature: body.temperature,
        cloudCover: body.cloudCover,
      }),
    );
    await this.cache.del('weather:list');
    return saved;
  }

  /** 简易参数化天气生成：给定日期与天气类型生成逐时序列，便于演示 */
  @Post('generate')
  @Roles('manager')
  async generate(
    @Query('date') date: string,
    @Query('kind') kind: 'sunny' | 'cloudy' | 'overcast' | 'hot' = 'sunny',
  ) {
    const profile = generateWeather(date, kind);
    return this.import(profile);
  }
}

export function generateWeather(date: string, kind: string): ImportPayload {
  const irradiance = Array.from({ length: 24 }, (_, h) => {
    const x = (h - 12) / 4;
    return Math.max(0, Math.round(950 * Math.exp(-x * x)));
  });
  let cloudBase: number;
  let tempBase: number[];
  let label: string;
  switch (kind) {
    case 'cloudy':
      cloudBase = 0.45;
      label = '多云波动日';
      tempBase = [22, 21, 21, 20, 20, 21, 22, 23, 24, 25, 26, 27, 28, 28, 28, 27, 26, 25, 24, 23, 23, 22, 22, 21];
      break;
    case 'overcast':
      cloudBase = 0.85;
      label = '阴雨遮蔽日';
      tempBase = [19, 19, 18, 18, 18, 18, 19, 20, 21, 22, 23, 23, 24, 24, 24, 23, 23, 22, 22, 21, 21, 20, 20, 19];
      break;
    case 'hot':
      cloudBase = 0.1;
      label = '高温晴热日';
      tempBase = [28, 27, 27, 26, 26, 27, 29, 31, 33, 35, 37, 38, 39, 40, 40, 39, 38, 36, 34, 33, 32, 31, 30, 29];
      break;
    default:
      cloudBase = 0.08;
      label = '典型晴朗日';
      tempBase = [24, 23, 23, 22, 22, 23, 24, 25, 27, 29, 31, 33, 34, 35, 35, 34, 33, 32, 30, 29, 28, 27, 26, 25];
  }
  // 逐时云量加随机波动，体现“天气波动真实影响结果”
  const cloudCover = Array.from({ length: 24 }, (_, h) => {
    const wave = h >= 9 && h <= 17 ? 0.25 * Math.sin(h * 2.1) : 0;
    const jitter = 0.1 * Math.sin(h * 5.7 + date.length);
    return Math.min(1, Math.max(0, Math.round((cloudBase + wave + jitter) * 100) / 100));
  });
  return { date, label, irradiance, temperature: tempBase, cloudCover };
}
