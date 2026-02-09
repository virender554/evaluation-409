
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { INestApplicationContext } from '@nestjs/common';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext, // super(app) requires this as first arg
    // But standard IoAdapter constructor takes App.
    // However, I need ConfigService inside.
    // Let's pass app or initialize inside?
    // Usually passed in main.ts
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const app = (this as any).httpServer; // Wait, IoAdapter doesn't expose app easily? Ah, super(app) stores it.
    // Wait, createAdapter needs Redis clients.
    // I can get ConfigService from app context if passed in constructor properly?
    // Or assume environment variables are loaded?
    // Let's rely on process.env for simplicity in adapter or pass specific config.
    // But cleaner is to resolve ConfigService from app.
    
    // Actually, let's just use process.env here or pass config from main.
    // But better:
    // const configService = this.app.get(ConfigService); // this.app is available if passed to super?
    // Checking @nestjs/platform-socket.io source... IoAdapter(appOrHttpServer).
    
    const pubClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
