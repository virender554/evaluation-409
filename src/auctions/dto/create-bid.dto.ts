
import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBidDto {
  @IsNumber()
  @Min(0.01) // Assuming min bid increment or absolute min value
  @Type(() => Number)
  amount: number;
}
