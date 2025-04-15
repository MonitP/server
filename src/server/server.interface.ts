import { Servers } from './entities/server.entity';

export interface ProcessStatus {
  name: string;
}

export interface ServerStatus {
  id: string;
  name: string;
  code: string;
  cpu: number;
  memory: number;
  disk: number;
  processes: ProcessStatus[];
  status: 'connected' | 'disconnected';
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