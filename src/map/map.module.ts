import { Module } from '@nestjs/common';
import { MapService } from './map.service';
import { MapController } from './map.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Map, MapSchema } from './map.schema';

@Module({
  controllers: [MapController],
  providers: [MapService],
  imports: [MongooseModule.forFeature([{ name: 'Map', schema: MapSchema }])],
})
export class MapModule {}
