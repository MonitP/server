import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Servers } from '../../server/entities/server.entity';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  serverCode: string;

  @ManyToOne(() => Servers)
  @JoinColumn({ name: 'serverCode', referencedColumnName: 'code' })
  server: Servers;

  @Column({ length: 20 })
  type: string;

  @Column('text')
  message: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;
} 