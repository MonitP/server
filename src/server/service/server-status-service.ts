import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ProcessStatus, ServerStatus } from '../server.interface';
import { ServerService } from './server.service';
import { Servers } from '../entities';
import { Server } from 'socket.io';

@Injectable()
export class ServerStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServerStatusService.name);
  private serverMap = new Map<string, ServerStatus>();
  private processIdCounters = new Map<string, number>();
  private socketServer: Server;
  private updateInterval: NodeJS.Timeout;
  private socketToCodeMap = new Map<string, string>(); // socketId -> serverCode

  constructor(private readonly serverService: ServerService) {}

  onModuleInit() {
    this.updateInterval = setInterval(() => {
      if (this.socketServer) {
        const data = this.getAll();
        this.socketServer.emit('update', data);
      }
    }, 5000);
  }

  onModuleDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  setSocketServer(server: Server) {
    this.socketServer = server;
  }

  getAll(): ServerStatus[] {
    return Array.from(this.serverMap.values());
  }

  async update(code: string, status: {
    cpu: number;
    memory: number;
    disk: number;
    processes: string[];
    status: 'connected' | 'disconnected';
  }, socketId: string) {
    try {
      const server = await this.serverService.findByCode(code);
      if (!server) {
        return;
      }

      // 소켓 ID와 서버 코드 매핑 저장
      this.socketToCodeMap.set(socketId, code);

      let serverStatus = this.serverMap.get(code);
      if (!serverStatus) {
        serverStatus = {
          id: server.id,
          name: server.name,
          code: server.code,
          cpu: 0,
          memory: 0,
          disk: 0,
          processes: [],
          status: 'connected',
          lastUpdate: new Date(),
          cpuHistory: [0],
          memoryHistory: [0],
        };
        this.processIdCounters.set(code, 0);
        this.logger.log(`🆕 새로운 서버 등록: ${server.name} (${code})`);
      }

      // 현재 실행 중인 프로세스들을 stopped 상태로 변경
      serverStatus.processes.forEach(process => {
        process.status = 'stopped';
      });

      // 새로 받은 프로세스들을 running 상태로 설정
      const processStatuses: ProcessStatus[] = status.processes.map(name => {
        const existingProcess = serverStatus.processes.find(p => p.name === name);
        if (existingProcess) {
          existingProcess.status = 'running';
          return existingProcess;
        }
        return {
          name,
          status: 'running'
        };
      });

      const newProcessNames = new Set(status.processes);
      serverStatus.processes = serverStatus.processes
        .filter(p => !newProcessNames.has(p.name))
        .concat(processStatuses);

      await this.serverService.updateProcesses(code, serverStatus.processes);

      serverStatus.cpu = status.cpu;
      serverStatus.memory = status.memory;
      serverStatus.disk = status.disk;
      serverStatus.status = status.status;
      serverStatus.lastUpdate = new Date();

      serverStatus.cpuHistory.push(status.cpu);
      serverStatus.memoryHistory.push(status.memory);
      if (serverStatus.cpuHistory.length > 60) serverStatus.cpuHistory.shift();
      if (serverStatus.memoryHistory.length > 60) serverStatus.memoryHistory.shift();

      this.serverMap.set(code, serverStatus);
    } catch (error) {
      this.logger.error(`서버 상태 업데이트 실패: code=${code}, error=${error.message}`);
    }
  }

  remove(code: string) {
    const server = this.serverMap.get(code);
    if (server) {
      this.serverMap.delete(code);
      this.processIdCounters.delete(code);
    }
  }

  setDisconnected(socketId: string) {
    const serverCode = this.socketToCodeMap.get(socketId);
    if (serverCode) {
      const serverStatus = this.serverMap.get(serverCode);
      if (serverStatus) {
        serverStatus.status = 'disconnected';
        serverStatus.processes.forEach(process => {
          process.status = 'stopped';
        });
        this.logger.log(`서버 연결 끊김: ${serverStatus.name} (${serverCode})`);
      }
      this.socketToCodeMap.delete(socketId);
    }
  }
}
