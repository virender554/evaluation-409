import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { AuctionItem } from '../auctions/auction-item.entity';
import { Bid } from '../bids/bid.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  balance: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => AuctionItem, (auction) => auction.creator)
  auctionsCreated: AuctionItem[];

  @OneToMany(() => Bid, (bid) => bid.bidder)
  bids: Bid[];

  @OneToMany(() => AuctionItem, (auction) => auction.winner)
  auctionsWon: AuctionItem[];
}
