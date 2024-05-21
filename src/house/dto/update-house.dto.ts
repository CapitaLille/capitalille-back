import { PartialType } from '@nestjs/swagger';
import { CreateLobbyHousesDto } from './create-lobby-houses.dto';

export class UpdateHouseDto extends PartialType(CreateLobbyHousesDto) {}
