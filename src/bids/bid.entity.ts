import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { AuctionItem } from '../auctions/auction-item.entity';

@Entity()
@Index(['auctionItem', 'amount'])
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 18, scale: 2 })
  amount: number;

  @Column('timestamptz')
  @CreateDateColumn()
  createdAt: Date;

  @Column()
  bidderId: string;

  @ManyToOne(() => User, (user) => user.bids)
  bidder: User;

  @Column()
  auctionItemId: string;

  @ManyToOne(() => AuctionItem, (auction) => auction.bids)
  auctionItem: AuctionItem;
}
