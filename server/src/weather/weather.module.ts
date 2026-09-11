import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherData } from '../entities/weather.entity';
import { WeatherController } from './weather.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WeatherData])],
  controllers: [WeatherController],
})
export class WeatherModule {}
