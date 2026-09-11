import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * 一天 24 小时逐时天气。
 * date 形如 2026-09-10；数组长度固定 24。
 */
@Entity('weather_data')
export class WeatherData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10, unique: true })
  date: string;

  @Column({ length: 32, default: '典型晴朗日' })
  label: string;

  /** 逐时水平面辐照 W/m²（长度 24） */
  @Column({ type: 'simple-json' })
  irradiance: number[];

  /** 逐时环境温度 ℃（长度 24） */
  @Column({ type: 'simple-json' })
  temperature: number[];

  /** 逐时云量 0-1（长度 24），用于体现天气波动 */
  @Column({ type: 'simple-json' })
  cloudCover: number[];
}
