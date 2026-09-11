import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DeviceStatusDto, MoveDeviceDto, UpsertDeviceDto } from './dto';
import { CacheService } from '../cache/cache.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(
    @InjectRepository(Device) private repo: Repository<Device>,
    private cache: CacheService,
  ) {}

  @Get()
  list() {
    return this.repo.find({ order: { type: 'ASC', id: 'ASC' } });
  }

  /** 设备库变更后清除所有天气日的基线推演缓存 */
  private async invalidateBaseline() {
    await this.cache.delPrefix('sim:baseline:');
  }

  @Post()
  @Roles('manager')
  async create(@Body() dto: UpsertDeviceDto) {
    const saved = await this.repo.save(this.repo.create(dto));
    await this.invalidateBaseline();
    return saved;
  }

  @Put(':id')
  @Roles('manager')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertDeviceDto) {
    await this.repo.update(id, dto);
    await this.invalidateBaseline();
    return this.repo.findOne({ where: { id } });
  }

  /** 地图拖拽后保存坐标 */
  @Patch(':id/move')
  @Roles('manager')
  async move(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveDeviceDto) {
    await this.repo.update(id, { x: dto.x, y: dto.y });
    return this.repo.findOne({ where: { id } });
  }

  /** 设置/解除设备故障（用于实际运行与故障回放） */
  @Patch(':id/status')
  @Roles('manager')
  async setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeviceStatusDto,
  ) {
    await this.repo.update(id, {
      status: dto.status,
      faultMessage: dto.status === 'fault' ? dto.faultMessage || '设备故障' : '',
    });
    await this.invalidateBaseline();
    return this.repo.findOne({ where: { id } });
  }

  @Delete(':id')
  @Roles('manager')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.repo.delete(id);
    await this.invalidateBaseline();
    return { ok: true };
  }
}
