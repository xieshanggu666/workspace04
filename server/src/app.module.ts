import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { WeatherModule } from './weather/weather.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { SimulationModule } from './simulation/simulation.module';
import { AlarmsModule } from './alarms/alarms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CacheModule,
    AuthModule,
    DevicesModule,
    WeatherModule,
    TariffsModule,
    ScenariosModule,
    SimulationModule,
    AlarmsModule,
  ],
})
export class AppModule {}
