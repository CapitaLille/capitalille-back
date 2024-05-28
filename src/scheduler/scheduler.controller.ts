import { Server } from 'socket.io';
import { Controller, HttpStatus } from '@nestjs/common';
import { SchedulerService } from '../server/scheduler.service';
import { LobbyService } from 'src/lobby/lobby.service';
import { PlayerService } from 'src/player/player.service';
import { HouseService } from 'src/house/house.service';
import { Bank, Doc, GameEvent } from 'src/server/server.type';
import { Lobby } from 'src/lobby/lobby.schema';
import { MapService } from 'src/map/map.service';
import { ServerService } from 'src/server/server.service';
import { houseState } from 'src/house/house.schema';
import { transactionType } from 'src/player/player.schema';
import { CaseType } from 'src/map/map.schema';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}
}
