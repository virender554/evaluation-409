
import { Controller, Get, Post, Body, Param, Query, UseGuards, ValidationPipe, UsePipes, ParseUUIDPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { AuctionStatus } from './auction-item.entity';
import { AddBalanceDto } from '../auth/dto/add-balance.dto';
import { AuthService } from '../auth/auth.service';

@Controller('auctions')
export class AuctionController {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly authService: AuthService,
  ) {}

  @Post('upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/auctions',
      filename: (req, file, callback) => {
        console.log("=======================>",file);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
        return callback(new BadRequestException('Only image files are allowed!'), false);
      }
      callback(null, true);
    },
  }))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is not an image');
    }
    return {
      imageUrl: `/uploads/auctions/${file.filename}`,
    };
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createAuctionDto: CreateAuctionDto, @CurrentUser() user: User) {
    return this.auctionService.create(createAuctionDto, user);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(
    @CurrentUser() user: User,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: AuctionStatus,
    @Query('sort') sort: 'ASC' | 'DESC' = 'ASC',
  ) {
    return this.auctionService.findAll(Number(page), Number(limit), status, sort, user.id);
  }

  //place bid on auction
  @Post(':id/bid')
  @UseGuards(AuthGuard('jwt'))
  async placeBid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createBidDto: CreateBidDto,
    @CurrentUser() user: User,
  ) {
    return this.auctionService.placeBid(id, createBidDto.amount, user);
  }

  //get my auaction
  @Get('my-auctions')
  @UseGuards(AuthGuard('jwt'))
  async getMyAuctions(@CurrentUser() user: User) {
    return this.auctionService.findMyAuctions(user.id);
  }

  @Post('add-balance')
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe({ transform: true }))
  async addBalance(@Body() addBalanceDto: AddBalanceDto, @CurrentUser() user: User) {
    return this.authService.addBalance(user?.id, addBalanceDto.amount);
  }

  // get user profile
  // get balance of user and details
  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@CurrentUser() user: User) {
    return this.auctionService.getProfile(user.id);
  }


  
  //dashboard
  @Get('dashboard')
  @UseGuards(AuthGuard('jwt'))
  async getDashboard(@CurrentUser() user: User) {
    return this.auctionService.getDashboard(user.id);
  }

  //get auction by id(my added auction)
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auctionService.findOne(id);
  }

}
