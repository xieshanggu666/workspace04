import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type ScenarioMode = 'baseline' | 'plan';

@Entity('scenarios')
export class Scenario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  name: string;

  /** baseline=当前实际运行方案（管理员）；plan=规划方案（规划师） */
  @Column({ length: 16, default: 'plan' })
  mode: ScenarioMode;

  @Column({ default: true })
  isDefault: boolean;

  /**
   * 方案相对当前设备的覆盖配置：
   * {
   *   devices: [{ id?, type, name, x, y, params, status }],  // id 为空=新增
   *   removedDeviceIds: number[],
   *   tariffOverrides: { periods?, valleyPrice?, flatPrice?, peakPrice? },
   *   weatherDate: '2026-09-10'
   * }
   */
  @Column({ type: 'simple-json', nullable: true })
  config: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
