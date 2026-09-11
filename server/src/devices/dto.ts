import { IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertDeviceDto {
  @IsIn(['pv', 'battery', 'charger', 'building'])
  type: 'pv' | 'battery' | 'charger' | 'building';

  @IsString()
  name: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsObject()
  @IsOptional()
  params?: Record<string, any>;

  @IsIn(['normal', 'fault'])
  @IsOptional()
  status?: 'normal' | 'fault';

  @IsString()
  @IsOptional()
  faultMessage?: string;
}

export class MoveDeviceDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class DeviceStatusDto {
  @IsIn(['normal', 'fault'])
  status: 'normal' | 'fault';

  @IsString()
  @IsOptional()
  faultMessage?: string;
}
