import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SimulationRun } from '../entities/simulation-run.entity';
import { CacheService } from '../cache/cache.service';
import { SimulationService } from './simulation.service';
import { ScenarioConfig } from './scenario-resolver';

interface RunBody {
  scenarioId?: number;
  weatherDate?: string;
  /** 规划师画布上未保存的临时方案配置 */
  config?: ScenarioConfig;
  save?: boolean;
  name?: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('simulation')
export class SimulationController {
  constructor(
    private sim: SimulationService,
    private cache: CacheService,
    @InjectRepository(SimulationRun) private runRepo: Repository<SimulationRun>,
  ) {}

  /** 核心推演接口：按方案 / 天气日计算 24 小时调度结果 */
  @Post('run')
  async run(@Body() body: RunBody) {
    const input = await this.sim.buildInput(
      body.scenarioId,
      body.weatherDate,
      body.config,
    );
    const result = await this.sim.run(input);

    let savedId: number | undefined;
    if (body.save) {
      const saved = await this.runRepo.save(
        this.runRepo.create({
          scenarioName: body.name ?? input.scenarioName,
          mode: body.scenarioId ? 'plan' : 'baseline',
          date: result.date,
          result: result as any,
        }),
      );
      savedId = saved.id;
    }
    return {
      scenarioName: input.scenarioName,
      scenarioId: input.scenarioId,
      cacheMode: this.cache.mode,
      savedRunId: savedId,
      result,
    };
  }

  /**
   * 管理员日常运行：当前实际设备 + 最新天气的基线推演，
   * 结果在 Redis 中缓存 5 分钟（设备状态变更时失效）。
   */
  @Get('baseline')
  async baseline(@Query('date') date?: string) {
    const cacheKey = `sim:baseline:${date ?? 'latest'}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return { ...cached, cached: true, cacheMode: this.cache.mode };

    const input = await this.sim.buildInput(undefined, date);
    const result = await this.sim.run(input);
    const payload = { scenarioName: '当前运行方案', result, cached: false };
    await this.cache.set(cacheKey, payload, 300);
    if (!date) await this.cache.set('sim:baseline:latest', payload, 300);
    return { ...payload, cacheMode: this.cache.mode };
  }

  /** 多方案容量对比 */
  @Post('compare')
  async compare(
    @Body()
    body: {
      items: Array<{ name?: string; scenarioId?: number; config?: ScenarioConfig }>;
      weatherDate?: string;
    },
  ) {
    const items = body.items?.length
      ? body.items
      : [{ name: '当前运行方案' }];

    const results: any[] = [];
    for (const item of items) {
      const input = await this.sim.buildInput(
        item.scenarioId,
        body.weatherDate,
        item.config,
      );
      const result = await this.sim.run(input);
      results.push({ name: item.name ?? input.scenarioName, kpi: result.kpi, result });
    }

    // 以第一项为基准计算差值
    const base = results[0]?.kpi;
    for (const r of results) {
      r.delta = base
        ? {
            totalCostYuan: round(r.kpi.totalCostYuan - base.totalCostYuan),
            peakImportKw: round(r.kpi.peakImportKw - base.peakImportKw),
            gridImportKwh: round(r.kpi.gridImportKwh - base.gridImportKwh),
            renewableCoverageRate: round(
              r.kpi.renewableCoverageRate - base.renewableCoverageRate,
            ),
          }
        : null;
    }
    return { date: body.weatherDate ?? '', items: results };
  }

  @Get('runs')
  listRuns() {
    return this.runRepo.find({
      order: { id: 'DESC' },
      select: ['id', 'scenarioName', 'mode', 'date', 'createdAt'],
    });
  }

  @Get('runs/:id')
  getRun(@Param('id', ParseIntPipe) id: number) {
    return this.runRepo.findOne({ where: { id } });
  }
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
