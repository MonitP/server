import { Servers } from './entities/server.entity';

export interface ProcessStatus {
  name: string;
  version: string;
  status: 'running' | 'stopped';
  lastUpdate?: Date;
  runningTime?: number;
  startTime?: Date;
}

export interface ServerStatus {
  id: string;
  name: string;
  code: string;
  cpu: number;
  ram: number;
  disk: number;
  gpu: number;
  network: number;
  processes: ProcessStatus[];
  status: 'connected' | 'disconnected' | 'on' | 'off';
  lastUpdate: Date;
  cpuHistory: number[];
  ramHistory: number[];
  gpuHistory: number[];
  networkHistory: number[];
  upTime: number;
  downTime: number;
  lastRestart?: Date;
  startTime?: Date;
}


export interface IServerResponse {
  success: boolean;
  message: string;
  data?: Servers | Servers[];
}

export interface IServerQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface IServerStats {
  total: number;
  active: number;
  inactive: number;
  lastUpdated: Date;
} 