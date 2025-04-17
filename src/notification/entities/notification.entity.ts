import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  serverName: string;

  @Column()
  serverCode: string;

  @Column()
  type: number;

  @Column({ default: false })
  read: boolean;

  @Column()
  timestamp: Date;
}