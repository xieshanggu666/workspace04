import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tariff } from '../entities/tariff.entity';
import { TariffController } from './tariff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tariff])],
  controllers: [TariffController],
})
export class TariffsModule {}
