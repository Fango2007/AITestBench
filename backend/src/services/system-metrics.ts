import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { getDb } from '../models/db';

const execFileAsync = promisify(execFile);

interface CpuSample {
  idle: number;
  total: number;
}

let lastCpuSample: CpuSample | null = null;

function readCpuSample(): CpuSample {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }

  return { idle, total };
}

function toNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readGpuMetrics(): Promise<{
  available: boolean;
  utilization_percent: number | null;
  memory_used_mb: number | null;
  memory_total_mb: number | null;
}> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      { timeout: 750, windowsHide: true }
    );
    const line = stdout.trim().split('\n')[0];
    if (!line) {
      return {
        available: false,
        utilization_percent: null,
        memory_used_mb: null,
        memory_total_mb: null
      };
    }
    const [utilization, used, total] = line.split(',').map((entry) => entry.trim());
    return {
      available: true,
      utilization_percent: toNumber(utilization),
      memory_used_mb: toNumber(used),
      memory_total_mb: toNumber(total)
    };
  } catch {
    return {
      available: false,
      utilization_percent: null,
      memory_used_mb: null,
      memory_total_mb: null
    };
  }
}

export async function getSystemMetrics(): Promise<{
  cpu: {
    usage_percent: number | null;
    cores: number;
    load_1m: number;
    load_5m: number;
    load_15m: number;
  };
  memory: {
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    used_percent: number;
  };
  gpu: {
    available: boolean;
    utilization_percent: number | null;
    memory_used_mb: number | null;
    memory_total_mb: number | null;
  };
  db: {
    ok: boolean;
  };
}> {
  const nextSample = readCpuSample();
  let usagePercent: number | null = null;

  if (lastCpuSample) {
    const idleDelta = nextSample.idle - lastCpuSample.idle;
    const totalDelta = nextSample.total - lastCpuSample.total;
    if (totalDelta > 0) {
      usagePercent = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100));
      usagePercent = Math.round(usagePercent * 10) / 10;
    }
  }

  lastCpuSample = nextSample;

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usedPercent = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;

  const [load1, load5, load15] = os.loadavg();
  const gpu = await readGpuMetrics();
  let dbOk = false;
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return {
    cpu: {
      usage_percent: usagePercent,
      cores: os.cpus().length,
      load_1m: load1,
      load_5m: load5,
      load_15m: load15
    },
    memory: {
      total_bytes: totalMemory,
      free_bytes: freeMemory,
      used_bytes: usedMemory,
      used_percent: Math.round(usedPercent * 10) / 10
    },
    gpu,
    db: {
      ok: dbOk
    }
  };
}
