# Implementation Plan: TypeORM Entities and Migration

We will create the core entities for the auction system with robust TypeORM configurations, including relationships, optimistic locking, and proper indexing. We will also set up proper database migrations.

## User Story

As a developer, I want a well-structured database schema forUsers, AuctionItems, and Bids so that the application can handle concurrent auctions safely and performantly, with a reliable migration history.

## Proposed Changes

### 1. Disable Synchronization

- **File**: `src/app.module.ts`
- **Change**: Set `synchronize: false` in `TypeOrmModule` configuration to enforce migration usage.

### 2. User Entity (`src/users/user.entity.ts`)

- **Columns**:
    - `id`: UUID (Primary Key)
    - `email`: unique string
    - `passwordHash`: string
    - `balance`: decimal(18, 2), default 0
    - `createdAt`: timestamp with timezone
- **Relations**:
    - `auctionsCreated`: OneToMany to `AuctionItem`
    - `bids`: OneToMany to `Bid`
    - `auctionsWon`: OneToMany to `AuctionItem` (where user is the winner)

### 3. AuctionItem Entity (`src/auctions/auction-item.entity.ts`)

- **Columns**:
    - `id`: UUID (Primary Key)
    - `title`: string
    - `description`: text
    - `startingPrice`: decimal(18, 2)
    - `currentPrice`: decimal(18, 2)
    - `status`: enum ('draft', 'active', 'sold', 'expired') - use string for simplicity if Postgres enum support is complex with TypeORM, but native Enum is preferred.
    - `endsAt`: timestamp with timezone
    - `createdAt`: timestamp with timezone
    - `version`: `@VersionColumn` for optimistic locking
- **Relations**:
    - `creator`: ManyToOne to `User` (join column `creatorId`)
    - `winner`: ManyToOne to `User` (nullable, join column `winnerId`)
    - `bids`: OneToMany to `Bid`
- **Indexes**:
    - Index on `status` and `endsAt` for querying active/expired auctions.

### 4. Bid Entity (`src/bids/bid.entity.ts`)

- **Columns**:
    - `id`: UUID (Primary Key)
    - `amount`: decimal(18, 2)
    - `createdAt`: timestamp with timezone
- **Relations**:
    - `bidder`: ManyToOne to `User` (join column `bidderId`)
    - `auctionItem`: ManyToOne to `AuctionItem` (join column `auctionItemId`)
- **Indexes**:
    - Index on `auctionItemId` + `amount` (desc) for quickly finding the highest bid.

### 5. Migration Setup

- **File**: `data-source.ts` (new file at root or src)
- **Purpose**: Configuration for TypeORM CLI to run migrations.
- **Action**: Create initial migration to generate tables.

## Verification Plan

### Automated Tests
- Create unit tests for entities (basic structure).
- Create a migration test script (e.g., `npm run migration:run`) to ensure the schema applies cleanly.

### Manual Verification
- Review generated SQL migration file.
- Inspect database schema using a tool or `psql` command line to verify table structures and constraints.
