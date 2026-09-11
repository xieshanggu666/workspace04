import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type DeviceType = 'pv' | 'battery' | 'charger' | 'building';
export type DeviceStatus = 'normal' | 'fault';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  /** pv=光伏 battery=储能 charger=充电桩 building=楼宇 */
  @Column({ length: 16 })
  type: DeviceType;

  @Column({ length: 64 })
  name: string;

  /** 校园地图上的横坐标（0-1000） */
  @Column('double', { default: 100 })
  x: number;

  /** 校园地图上的纵坐标（0-700） */
  @Column('double', { default: 100 })
  y: number;

  /**
   * 设备参数：
   * pv:      { capacityKw, tilt, azimuth }
   * battery: { capacityKwh, powerKw, eff, minSoc, maxSoc, initialSoc }
   * charger: { powerKw, count }
   * building:{ areaM2, baseLoadKw, coolingFactor, profile: number[] }
   */
  @Column({ type: 'simple-json', nullable: true })
  params: Record<string, any>;

  @Column({ length: 16, default: 'normal' })
  status: DeviceStatus;

  /** 故障描述（status=fault 时有效） */
  @Column({ length: 255, default: '' })
  faultMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
