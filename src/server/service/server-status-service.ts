import { Injectable } from '@nestjs/common';
import { ProcessStatus, ServerStatus } from '../server.interface';

@Injectable()
export class ServerStatusService {
  private serverMap = new Map<string, ServerStatus>();
  private testInterval: NodeJS.Timeout | null = null;

  getAll(): ServerStatus[] {
    return Array.from(this.serverMap.values());
  }

  register(serverId: string, name: string) {
    this.serverMap.set(serverId, {
      id: serverId,
      name,
      cpu: 0,
      memory: 0,
      disk: 50,
      processes: [],
      status: 'connected',
      lastUpdate: new Date(),
      cpuHistory: [0],
      memoryHistory: [0],
    });
  }

  update(serverId: string, status: {
    cpu: number;
    memory: number;
    processes: ProcessStatus[];
  }) {
    const server = this.serverMap.get(serverId);
    if (!server) return;

    server.cpu = status.cpu;
    server.memory = status.memory;
    server.processes = status.processes;
    server.status = status.processes.every(p => p.status === 'running') ? 'connected' : 'disconnected';
    server.lastUpdate = new Date();

    server.cpuHistory.push(status.cpu);
    server.memoryHistory.push(status.memory);
    if (server.cpuHistory.length > 60) server.cpuHistory.shift();
    if (server.memoryHistory.length > 60) server.memoryHistory.shift();

    this.serverMap.set(serverId, server);
  }

  remove(serverId: string) {
    this.serverMap.delete(serverId);
  }

  seedDummyData() {
    const dummy: ServerStatus[] = [
      {
        id: 'server-1',
        name: 'server 1',
        status: 'connected',
        cpu: 30,
        memory: 4096,
        disk: 100,
        processes: [
          { id: 'process-1', name: 'Process 1', status: 'running' },
          { id: 'process-2', name: 'Process 2', status: 'running' },
        ],
        lastUpdate: new Date(),
        cpuHistory: [30],
        memoryHistory: [4096],
      },
      {
        id: 'server-2',
        name: 'server 2',
        status: 'connected',
        cpu: 25,
        memory: 2048,
        disk: 100,
        processes: [
          { id: 'process-1', name: 'Process 1', status: 'running' },
          { id: 'process-2', name: 'Process 2', status: 'stopped' },
        ],
        lastUpdate: new Date(),
        cpuHistory: [25],
        memoryHistory: [2048],
      },
      {
        id: 'server-3',
        name: 'server 3',
        status: 'disconnected',
        cpu: 0,
        memory: 0,
        disk: 100,
        processes: [
          { id: 'process-1', name: 'Process 1', status: 'stopped' },
          { id: 'process-2', name: 'Process 2', status: 'stopped' },
        ],
        lastUpdate: new Date(),
        cpuHistory: [0],
        memoryHistory: [0],
      },
    ];

    dummy.forEach(s => this.serverMap.set(s.id, s));
  }

  startTestUpdates(onUpdate: () => void) {
    if (this.testInterval) clearInterval(this.testInterval);
    this.testInterval = setInterval(() => {
      this.updateDummyData();
      onUpdate();
    }, 5000);
  }

  private updateDummyData() {
    this.serverMap.forEach((server, id) => {
      server.processes = server.processes.map(p => ({
        ...p,
        status: Math.random() > 0.1 ? p.status : (p.status === 'running' ? 'stopped' : 'running'),
      }));

      server.cpu = Math.max(0, Math.min(100, +(server.cpu + (Math.random() * 10 - 5)).toFixed(1)));
      server.memory = Math.max(0, server.memory + (Math.random() * 100 - 50));

      server.cpuHistory.push(server.cpu);
      server.memoryHistory.push(server.memory);
      if (server.cpuHistory.length > 60) server.cpuHistory.shift();
      if (server.memoryHistory.length > 60) server.memoryHistory.shift();

      server.status = server.processes.every(p => p.status === 'running') ? 'connected' : 'disconnected';
      server.lastUpdate = new Date();

      this.serverMap.set(id, server);
    });
  }
}
