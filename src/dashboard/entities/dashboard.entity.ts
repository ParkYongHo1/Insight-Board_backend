import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('dashboards')
export class DashboardModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  desc: string;

  @Column({ type: 'json' })
  groups: unknown[];

  @Column({ type: 'json' })
  metrics: unknown[];

  @Column({ nullable: true })
  author: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  constructor(partial: Partial<DashboardModel>) {
    Object.assign(this, partial);
  }
}
