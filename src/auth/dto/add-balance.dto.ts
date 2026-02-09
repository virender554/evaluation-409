import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AddBalanceDto {
  @IsNumber()
  @Min(0.01)
  @Max(1000000000) // Max 1 billion per transaction to prevent overflow
  @Type(() => Number)
  amount: number;
}
