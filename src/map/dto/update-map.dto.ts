import { PartialType } from '@nestjs/swagger';
import { CreateMapDto } from './create-map.dto';

export class UpdateMapDto extends PartialType(CreateMapDto) {}
