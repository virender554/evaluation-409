
import { IsString, IsNotEmpty, IsNumber, Min, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  startingPrice: number;

  @IsDateString()
  endsAt: string;
}
