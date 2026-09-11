import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDbOptions } from './data-source';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => getDbOptions(),
    }),
  ],
})
export class DatabaseModule {}
