import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Scenario } from '../entities/scenario.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SaveScenarioDto } from './dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('scenarios')
export class ScenariosController {
  constructor(
    @InjectRepository(Scenario) private repo: Repository<Scenario>,
  ) {}

  @Get()
  list() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.repo.findOne({ where: { id } });
  }

  /** 规划师保存容量方案 */
  @Post()
  @Roles('planner')
  create(@Body() dto: SaveScenarioDto) {
    return this.repo.save(
      this.repo.create({ mode: 'plan', isDefault: false, ...dto }),
    );
  }

  @Put(':id')
  @Roles('planner')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveScenarioDto,
  ) {
    await this.repo.update(id, dto);
    return this.repo.findOne({ where: { id } });
  }

  @Delete(':id')
  @Roles('planner')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.repo.delete(id);
    return { ok: true };
  }
}
