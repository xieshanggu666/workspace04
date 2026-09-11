import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scenario } from '../entities/scenario.entity';
import { ScenariosController } from './scenarios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Scenario])],
  controllers: [ScenariosController],
})
export class ScenariosModule {}
