import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveScenarioDto {
  @IsString()
  name: string;

  @IsIn(['baseline', 'plan'])
  @IsOptional()
  mode?: 'baseline' | 'plan';

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsOptional()
  isDefault?: boolean;
}
