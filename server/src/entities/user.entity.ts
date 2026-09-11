import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, unique: true })
  username: string;

  @Column({ length: 64 })
  password: string;

  @Column({ length: 32 })
  displayName: string;

  /** manager=能源管理员（日常运行） planner=规划师（方案模拟） */
  @Column({ length: 16 })
  role: 'manager' | 'planner';
}
