import { PartialType } from '@nestjs/swagger';
import { CreatePlayerDto } from './create-player.dto';
import { Transaction } from '../player.schema';
import mongoose from 'mongoose';

export class UpdatePlayerDto extends PartialType(CreatePlayerDto) {}
