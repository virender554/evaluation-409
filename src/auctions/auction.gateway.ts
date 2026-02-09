
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Injectable, UseGuards, UnauthorizedException } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'auctions',
})
@Injectable()
export class AuctionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private redisClient: Redis;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    });
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }
      const payload = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
      });
      client.data.user = payload;
      // console.log(`Client connected: ${client.id}, User: ${payload.sub}`);
    } catch (e) {
      // console.error(`Authentication failed for client ${client.id}:`, e.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // Handle viewer count decrement if user was viewing an auction
    // We need to know which auction they were viewing.
    // Iterating rooms is one way, but rooms are cleared on disconnect instantly?
    // Socket.io 'disconnecting' event gives access to rooms. 'disconnect' might not.
    // Ideally we track `client.data.currentAuctionId`.
    const auctionId = client.data.currentAuctionId;
    if (auctionId) {
      await this.decrementViewerCount(auctionId);
    }
    // console.log(`Client disconnected: ${client.id}`);
  }

  private extractToken(client: Socket): string | undefined {
    // Check query param or auth header
    if (client.handshake.query.token) {
      return client.handshake.query.token as string;
    }
    if (client.handshake.headers.authorization) {
      const [type, token] = client.handshake.headers.authorization.split(' ');
      if (type === 'Bearer') {
        return token;
      }
    }
    return undefined;
  }

  @SubscribeMessage('joinAuction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { auctionId: string },
  ) {
    const { auctionId } = data;
    if (!auctionId) return;

    // Leave previous if any
    if (client.data.currentAuctionId) {
       await client.leave(`auction:${client.data.currentAuctionId}`);
       await this.decrementViewerCount(client.data.currentAuctionId);
    }

    await client.join(`auction:${auctionId}`);
    client.data.currentAuctionId = auctionId;
    await this.incrementViewerCount(auctionId);
    
    // Send current count immediately
    const count = await this.getViewerCount(auctionId);
    client.emit('VIEWER_COUNT', { auctionId, count });
  }

  @SubscribeMessage('leaveAuction')
  async handleLeaveAuction(@ConnectedSocket() client: Socket) {
     const auctionId = client.data.currentAuctionId;
     if (auctionId) {
         await client.leave(`auction:${auctionId}`);
         await this.decrementViewerCount(auctionId);
         client.data.currentAuctionId = null;
     }
  }

  async incrementViewerCount(auctionId: string) {
    const key = `auction:${auctionId}:viewers`;
    const count = await this.redisClient.incr(key);
    this.server.to(`auction:${auctionId}`).emit('VIEWER_COUNT', { auctionId, count });
  }

  async decrementViewerCount(auctionId: string) {
    const key = `auction:${auctionId}:viewers`;
    const count = await this.redisClient.decr(key);
    const finalCount = count < 0 ? 0 : count; // Safety
    if (count < 0) await this.redisClient.set(key, 0); 
    this.server.to(`auction:${auctionId}`).emit('VIEWER_COUNT', { auctionId, count: finalCount });
  }
  
  async getViewerCount(auctionId: string): Promise<number> {
      const key = `auction:${auctionId}:viewers`;
      const val = await this.redisClient.get(key);
      return val ? parseInt(val, 10) : 0;
  }
}
