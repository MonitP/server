import { Servers } from './entities/server.entity';

export interface ProcessStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped';
}

export interface ServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected';
  cpu: number;
  memory: number;
  disk: number;
  processes: ProcessStatus[];
  lastUpdate: Date;
  cpuHistory: number[];
  memoryHistory: number[];
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