
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { AuctionGateway } from './auction.gateway';
import { AuctionItem } from './auction-item.entity';
import { User } from '../users/user.entity';
import { Bid } from '../bids/bid.entity';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';

import { BullModule } from '@nestjs/bullmq';
import { AuctionProcessor } from './processors/auction.processor';
import { AuctionScheduler } from './schedulers/auction.scheduler';

@Module({
  imports: [
      TypeOrmModule.forFeature([AuctionItem, User, Bid]),
      AuthModule,
      ConfigModule,
      BullModule.registerQueue({
        name: 'auctions',
      }),
  ],
  controllers: [AuctionController],
  providers: [AuctionService, AuctionGateway, AuctionProcessor, AuctionScheduler],
  exports: [AuctionService], // Export if needed else removed
})
export class AuctionModule {}
