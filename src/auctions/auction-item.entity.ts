import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, VersionColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { Bid } from '../bids/bid.entity';

export enum AuctionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
}

@Entity()
@Index(['status', 'endsAt'])
export class AuctionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column('decimal', { precision: 18, scale: 2 })
  startingPrice: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  currentPrice: number;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.DRAFT,
  })
  status: AuctionStatus;

  @Column()
  creatorId: string;

  @ManyToOne(() => User, (user) => user.auctionsCreated)
  creator: User;

  @Column({ nullable: true })
  winnerId: string;

  @ManyToOne(() => User, (user) => user.auctionsWon, { nullable: true })
  winner: User;

  @OneToMany(() => Bid, (bid) => bid.auctionItem)
  bids: Bid[];

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ default: false })
  isEndingSoonNotified: boolean;

  @VersionColumn()
  version: number;
}
