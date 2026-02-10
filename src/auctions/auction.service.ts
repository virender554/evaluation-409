import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuctionItem, AuctionStatus } from './auction-item.entity';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { User } from '../users/user.entity';
import { Bid } from '../bids/bid.entity';
import { AuctionGateway } from './auction.gateway';


@Injectable()
export class AuctionService {
  constructor(
    @InjectRepository(AuctionItem)
    private auctionRepository: Repository<AuctionItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private auctionGateway: AuctionGateway,
  ) {}

  async create(createAuctionDto: CreateAuctionDto, user: User): Promise<AuctionItem> {
    const { endsAt, startingPrice, ...rest } = createAuctionDto;

    if (new Date(endsAt) <= new Date()) {
      throw new BadRequestException('endsAt must be in the future');
    }

    const auction = this.auctionRepository.create({
      ...rest,
      startingPrice,
      currentPrice: startingPrice, // Set currentPrice = startingPrice
      endsAt: new Date(endsAt),
      creator: user,
      status: AuctionStatus.ACTIVE, // Default status
    });

    return this.auctionRepository.save(auction);
  }

  async findAll(page: number = 1, limit: number = 10, status?: AuctionStatus, sort: 'ASC' | 'DESC' = 'ASC'): Promise<{ data: AuctionItem[], total: number, page: number, limit: number }> {
    const query = this.auctionRepository.createQueryBuilder('auction');

    if (status) {
      query.andWhere('auction.status = :status', { status });
    }

    // Prioritize ACTIVE auctions, then sort by endsAt (soonest first)
    query
      .leftJoinAndSelect('auction.creator', 'creator')
      .orderBy(`CASE WHEN auction.status = '${AuctionStatus.ACTIVE}' THEN 1 ELSE 2 END`, 'ASC')
      .addOrderBy('auction.endsAt', 'ASC')
      .addOrderBy('auction.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<AuctionItem> {
    const auction = await this.auctionRepository.createQueryBuilder('auction')
      .leftJoinAndSelect('auction.creator', 'creator')
      .leftJoinAndSelect('auction.winner', 'winner')
      .leftJoinAndSelect('auction.bids', 'bids')
      .leftJoinAndSelect('bids.bidder', 'bidder')
      .where('auction.id = :id', { id })
      .addOrderBy('bids.createdAt', 'DESC')
      .limit(20)
      .getOne();

    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    const bids = await this.dataSource.getRepository(Bid).find({
      where: { auctionItem: { id: id } },
      order: { createdAt: 'DESC' },
      take: 20,
      relations: ['bidder']
    });

    auction.bids = bids; 

    return auction;
  }

  async placeBid(auctionId: string, amount: number, user: User): Promise<any> {
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Lock Auction -> Pessimistic Write
      const auction = await manager.findOne(AuctionItem, {
        where: { id: auctionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!auction) {
        throw new NotFoundException(`Auction with ID ${auctionId} not found`);
      }

      // Fetch winner relation separately
      const auctionWithWinner = await manager.findOne(AuctionItem, {
          where: { id: auctionId },
          relations: ['winner']
      });
      if (auctionWithWinner) {
          auction.winner = auctionWithWinner.winner;
      }

      // 2. Check Expiry
      if (new Date() > auction.endsAt) {
        throw new BadRequestException('Auction has expired');
      }

      // 3. Check Price
      if (amount <= Number(auction.currentPrice)) {
         throw new BadRequestException('Bid amount must be greater than current price');
      }

      // 4. Fetch Bidder with Lock
      const bidder = await manager.findOne(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!bidder) {
        throw new NotFoundException('User not found');
      }

      // 5. Check Balance
      if (Number(bidder.balance) < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // 6. Escrow Logic
      // Deduct from bidder
      bidder.balance = Number(bidder.balance) - amount;
      await manager.save(bidder);

      // Refund previous winner
      if (auction.winner) {
        const previousWinner = await manager.findOne(User, {
            where: { id: auction.winner.id },
            lock: { mode: 'pessimistic_write' } 
        });
        
        if (previousWinner) {
            previousWinner.balance = Number(previousWinner.balance) + Number(auction.currentPrice);
            await manager.save(previousWinner);
        }
      }

      // Create Bid
      const bid = manager.create(Bid, {
        amount,
        bidder: bidder,
        auctionItem: auction,
      });
      await manager.save(bid);

      // Update Auction
      auction.currentPrice = amount;
      auction.winner = bidder;

      // Extend Auction if bid in last 10 seconds
      const timeDiff = auction.endsAt.getTime() - new Date().getTime();
      if (timeDiff <= 10000 && timeDiff > 0) {
        auction.endsAt = new Date(auction.endsAt.getTime() + 30000);
      }

      await manager.save(auction);
      
      // Return result
      return { status: 'success', currentPrice: amount, bidder: { id: bidder.id, email: bidder.email } };
    });

    // 7. Emit Event (outside transaction)
    this.auctionGateway.server.to(`auction:${auctionId}`).emit('NEW_BID', {
        auctionId,
        amount,
        bidderId: user.id,
        bidderEmail: user.email
    });

    return result;
  }

  async findExpiredUnsettledAuctions(): Promise<AuctionItem[]> {
    return this.auctionRepository.createQueryBuilder('auction')
      .where('auction.endsAt < :now', { now: new Date() })
      .andWhere('auction.status IN (:...statuses)', { statuses: [AuctionStatus.ACTIVE] })
      .getMany();
  }
  
  async findAuctionsEndingSoon(minutes: number): Promise<AuctionItem[]> {
      const now = new Date();
      const future = new Date(now.getTime() + minutes * 60000);
      
      return this.auctionRepository.createQueryBuilder('auction')
        .where('auction.endsAt BETWEEN :now AND :future', { now, future })
        .andWhere('auction.status = :status', { status: AuctionStatus.ACTIVE })
        .andWhere('auction.isEndingSoonNotified = :notified', { notified: false })
        .getMany();
  }

  async settleAuction(auctionId: string): Promise<void> {
      const result = await this.dataSource.transaction(async (manager) => {
          // Lock auction
          const auction = await manager.findOne(AuctionItem, {
                where: { id: auctionId },
                lock: { mode: 'pessimistic_write' },
            });
            // Fetch relations separately to avoid locking nullable joins
            if (!auction) return null;
            const auctionWithRelations = await manager.findOne(AuctionItem, {
                where: { id: auctionId },
                relations: ['winner', 'creator']
            });

            if (!auctionWithRelations) return null;
            Object.assign(auction, auctionWithRelations);

          if (!auction) return null;
          if (auction.status !== AuctionStatus.ACTIVE) return null; 

          let status = AuctionStatus.EXPIRED;
          let winnerId: string | null = null;
          let amount = 0;

          if (auction.winner) {
              // Mark SOLD
              auction.status = AuctionStatus.SOLD;
              status = AuctionStatus.SOLD;
              winnerId = auction.winner.id;
              amount = auction.currentPrice;
              
              // Transfer funds to creator
              const creator = await manager.findOne(User, {
                  where: { id: auction.creator.id },
                  lock: { mode: 'pessimistic_write' }
              });
              
              if (creator) {
                  creator.balance = Number(creator.balance) + Number(auction.currentPrice);
                  await manager.save(creator);
              }
              
              await manager.save(auction);
          } else {
              // Mark EXPIRED
              auction.status = AuctionStatus.EXPIRED;
              await manager.save(auction);
          }
          
          return { status, winnerId, amount };
      });

      if (!result) return;
      
      // Emit events based on transaction result
      if (result.status === AuctionStatus.SOLD) {
          this.auctionGateway.server.to(`auction:${auctionId}`).emit('AUCTION_SOLD', {
              auctionId,
              winnerId: result.winnerId,
              amount: result.amount
          });
      } else if (result.status === AuctionStatus.EXPIRED) {
          this.auctionGateway.server.to(`auction:${auctionId}`).emit('AUCTION_EXPIRED', {
              auctionId
          });
      }
  }

  async notifyEndingSoon(auction: AuctionItem): Promise<void> {
      const updateResult = await this.auctionRepository.update(
          { id: auction.id, isEndingSoonNotified: false },
          { isEndingSoonNotified: true }
      );
      
      if ((updateResult.affected || 0) > 0) {
          this.auctionGateway.server.to(`auction:${auction.id}`).emit('AUCTION_ENDING_SOON', {
              auctionId: auction.id,
              endsAt: auction.endsAt
          });
      }
  }

  async findMyAuctions(userId: string): Promise<AuctionItem[]> {
    return this.auctionRepository.find({
      where: { creator: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'balance', 'createdAt'],
    });
    return user;
  }

  async getDashboard(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['auctionsCreated', 'bids', 'auctionsWon'],
    });

    const { totalBalance } = await this.userRepository
      .createQueryBuilder('user')
      .select('SUM(user.balance)', 'totalBalance')
      .getRawOne();
    
    if (user) {
      return {
        id: user.id,
        email: user.email,
        balance: user.balance,
        totalAuctionsCreated: user.auctionsCreated.length,
        totalBidsPlaced: user.bids.length,
        totalAuctionsWon: user.auctionsWon.length,
        // totalSystemBalance: parseFloat(totalBalance || 0),
        createdAt: user.createdAt,
      };
    }
    
    return null;
  }
}
