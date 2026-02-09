
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AuctionService } from '../auction.service';
import { AuctionGateway } from '../auction.gateway';

@Processor('auctions')
@Injectable()
export class AuctionProcessor extends WorkerHost {
  private readonly logger = new Logger(AuctionProcessor.name);

  constructor(
    private readonly auctionService: AuctionService,
    private readonly auctionGateway: AuctionGateway,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'settle-auction':
        return this.handleSettleAuction(job);
      case 'outbid-notification':
        return this.handleOutbidNotification(job);
      // case 'auction-reminder': // Handled via scheduled task usually, or distinct job
      //   return this.handleAuctionReminder(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSettleAuction(job: Job<{ auctionId: string }>) {
    const { auctionId } = job.data;
    this.logger.log(`Processing settlement for auction: ${auctionId}`);
    try {
        await this.auctionService.settleAuction(auctionId);
        this.logger.log(`Settlement complete for auction: ${auctionId}`);
    } catch (e) {
        this.logger.error(`Failed to settle auction ${auctionId}: ${e.message}`, e.stack);
        throw e; // Retry
    }
  }

  private async handleOutbidNotification(job: Job<{ userId: string; auctionId: string }>) {
      const { userId, auctionId } = job.data;
      this.logger.log(`Sending outbid notification to user ${userId} for auction ${auctionId}`);
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 500));
      this.logger.log(`Outbid notification sent to user ${userId}`);
  }
}
