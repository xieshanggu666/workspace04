import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alarm } from '../entities/alarm.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SimulationService } from '../simulation/simulation.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('alarms')
export class AlarmsController {
  constructor(
    @InjectRepository(Alarm) private repo: Repository<Alarm>,
    private sim: SimulationService,
  ) {}

  @Get()
  list(
    @Query('scenario') scenario = 'baseline',
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    const where: any = { scenario };
    if (status) where.status = status;
    if (date) where.date = date;
    return this.repo.find({ where, order: { hour: 'ASC', id: 'ASC' } });
  }

  /** 确认 / 解除告警 */
  @Patch(':id')
  @Roles('manager')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'active' | 'acknowledged' | 'resolved' },
  ) {
    await this.repo.update(id, { status: body.status });
    return this.repo.findOne({ where: { id } });
  }

  /**
   * 根据当前实际设备与天气重新推演，把基线运行告警同步入库，
   * 用于故障回放（管理员设置设备故障后调用）。
   */
  @Post('sync')
  @Roles('manager')
  async sync(@Query('date') date?: string) {
    const input = await this.sim.buildInput(undefined, date);
    const result = await this.sim.run(input);
    await this.repo.delete({ scenario: 'baseline', date: result.date });
    const alarms = result.alarms.map((a) =>
      this.repo.create({
        ...a,
        scenario: 'baseline',
        date: result.date,
        status: 'active' as const,
      }),
    );
    await this.repo.save(alarms);
    return { synced: alarms.length, date: result.date };
  }
}
