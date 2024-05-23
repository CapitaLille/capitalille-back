import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Case, Configuration, House } from '../map.schema';

export class CreateMapDto {
  @ApiProperty({
    description: 'An array of houses.',
    type: [House],
  })
  @IsDefined({ message: 'houses is required' })
  @IsArray({ message: 'houses must be an array' })
  @ValidateNested({ each: true })
  @Type(() => House)
  houses: House[];

  @ApiProperty({
    description: 'An array of cases.',
    type: [Case],
  })
  @IsDefined({ message: 'cases is required' })
  @IsArray({ message: 'cases must be an array' })
  @ValidateNested({ each: true })
  @Type(() => Case)
  cases: Case[];

  @ApiProperty({
    description: 'The configuration of the map.',
    type: Configuration,
  })
  @IsDefined({ message: 'configuration is required' })
  @ValidateNested()
  @Type(() => Configuration)
  configuration: Configuration;
}
