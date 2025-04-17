import { Servers } from './entities/server.entity';

export interface ProcessStatus {
  name: string;
  status: 'running' | 'stopped';
}

export interface ServerStatus {
  id: string;
  name: string;
  code: string;
  cpu: number;
  ram: number;
  disk: number;
  gpu: number;
  processes: ProcessStatus[];
  status: 'connected' | 'disconnected' | 'on' | 'off';
  lastUpdate: Date;
  cpuHistory: number[];
  ramHistory: number[];
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