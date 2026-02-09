import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1770618865979 implements MigrationInterface {
    name = 'InitialSchema1770618865979'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."auction_item_status_enum" AS ENUM('draft', 'active', 'sold', 'expired')`);
        await queryRunner.query(`CREATE TABLE "auction_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text NOT NULL, "startingPrice" numeric(18,2) NOT NULL, "currentPrice" numeric(18,2) NOT NULL DEFAULT '0', "status" "public"."auction_item_status_enum" NOT NULL DEFAULT 'draft', "creatorId" uuid NOT NULL, "winnerId" uuid, "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "version" integer NOT NULL, CONSTRAINT "PK_27c3c60778327d48b589190ab20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_83f3dff5f4cdcfd80b20bfd8b8" ON "auction_item" ("status", "endsAt") `);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "balance" numeric(18,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bid" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(18,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "bidderId" uuid NOT NULL, "auctionItemId" uuid NOT NULL, CONSTRAINT "PK_ed405dda320051aca2dcb1a50bb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8bbc52122244c43151f295649e" ON "bid" ("auctionItemId", "amount") `);
        await queryRunner.query(`ALTER TABLE "auction_item" ADD CONSTRAINT "FK_8d2aeaec44bece0142a60d5fd1a" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auction_item" ADD CONSTRAINT "FK_72b318c89973cc8fb63db5414d6" FOREIGN KEY ("winnerId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bid" ADD CONSTRAINT "FK_1345c9f3ee0789dcff101f6c79b" FOREIGN KEY ("bidderId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bid" ADD CONSTRAINT "FK_733b44330c630550e6b88e845cd" FOREIGN KEY ("auctionItemId") REFERENCES "auction_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bid" DROP CONSTRAINT "FK_733b44330c630550e6b88e845cd"`);
        await queryRunner.query(`ALTER TABLE "bid" DROP CONSTRAINT "FK_1345c9f3ee0789dcff101f6c79b"`);
        await queryRunner.query(`ALTER TABLE "auction_item" DROP CONSTRAINT "FK_72b318c89973cc8fb63db5414d6"`);
        await queryRunner.query(`ALTER TABLE "auction_item" DROP CONSTRAINT "FK_8d2aeaec44bece0142a60d5fd1a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8bbc52122244c43151f295649e"`);
        await queryRunner.query(`DROP TABLE "bid"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83f3dff5f4cdcfd80b20bfd8b8"`);
        await queryRunner.query(`DROP TABLE "auction_item"`);
        await queryRunner.query(`DROP TYPE "public"."auction_item_status_enum"`);
    }

}
