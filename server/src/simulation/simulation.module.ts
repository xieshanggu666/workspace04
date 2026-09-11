import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { WeatherData } from '../entities/weather.entity';
import { Tariff } from '../entities/tariff.entity';
import { Scenario } from '../entities/scenario.entity';
import { SimulationRun } from '../entities/simulation-run.entity';
import { SimulationService } from './simulation.service';
import { SimulationController } from './simulation.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Device, WeatherData, Tariff, Scenario, SimulationRun]),
  ],
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
