import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Tariff } from '../entities/tariff.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('tariffs')
export class TariffController {
  constructor(@InjectRepository(Tariff) private repo: Repository<Tariff>) {}

  @Get()
  async list() {
    const list = await this.repo.find();
    return list[0] ?? null;
  }

  @Put()
  @Roles('manager')
  async update(@Body() body: Partial<Tariff>) {
    let tariff = (await this.repo.find())[0];
    if (!tariff) tariff = this.repo.create({ name: '校园分时电价' } as DeepPartial<Tariff>);
    Object.assign(tariff, body);
    return this.repo.save(tariff);
  }
}
