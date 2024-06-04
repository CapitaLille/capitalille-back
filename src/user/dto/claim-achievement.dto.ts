import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsMongoId, IsEnum, isDefined } from 'class-validator';
import mongoose from 'mongoose';
import { AchievementLevel, AchievementType } from '../user.schema';

export class ClaimAchievementDto {
  @IsDefined({ message: 'Achievements is required' })
  @ApiProperty({
    description: 'The achievements to claim.',
    type: String,
  })
  achievements: AchievementType;

  @IsDefined({ message: 'Level is required' })
  @ApiProperty({
    description: 'The level of the achievement.',
    type: String,
  })
  level: AchievementLevel;
}
