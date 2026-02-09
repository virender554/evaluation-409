
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AuctionService } from '../auction.service';

@Injectable()
export class AuctionScheduler {
  private readonly logger = new Logger(AuctionScheduler.name);

  constructor(
    @InjectQueue('auctions') private auctionQueue: Queue,
    private readonly auctionService: AuctionService, // To find candidate auctions
  ) {}

  // Check for auctions that need settlement every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleSettlements() {
    this.logger.log('Checking for auctions to settle...');
    // We need a method in service to find expired but not settled auctions
    const auctionsToSettle = await this.auctionService.findExpiredUnsettledAuctions();
    
    for (const auction of auctionsToSettle) {
      await this.auctionQueue.add('settle-auction', {
        auctionId: auction.id,
      }, {
        jobId: `settle-${auction.id}`, // Idempotency key
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
      this.logger.log(`Scheduled settlement for auction ${auction.id}`);
    }
  }

  // Check for auctions ending soon (e.g. in 5 mins) every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleReminders() {
      this.logger.log('Checking for auctions ending soon...');
      const auctionsEndingSoon = await this.auctionService.findAuctionsEndingSoon(5); // 5 minutes

      for (const auction of auctionsEndingSoon) {
          // Add job or just emit event directly?
          // Since it's lightweight, we can emit directly, or queue a job.
          // Queue is safer for reliability.
          // But here, let's just use the service method to emit.
          // Or we can queue 'auction-reminder'.
          // Let's implement 'auction-reminder' job in processor or just handle here?
          // The prompt asked for "Auction Reminder... Emit AUCTION_ENDING_SOON".
          // We can do it here.
          
          await this.auctionService.notifyEndingSoon(auction);
      }
  }
}
