import { HttpStatus, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Server } from 'socket.io';
import { houseState } from 'src/house/house.schema';
import { HouseService } from 'src/house/house.service';
import { Lobby } from 'src/lobby/lobby.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import { CaseType } from 'src/map/map.schema';
import { MapService } from 'src/map/map.service';
import { transactionType } from 'src/player/player.schema';
import { PlayerService } from 'src/player/player.service';
import { ServerService } from 'src/server/server.service';
import { Doc, Bank, GameEvent } from 'src/server/server.type';

@Injectable()
export class SchedulerService {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly lobbyService: LobbyService,
    private readonly serverService: ServerService,
    private readonly playerService: PlayerService,
    private readonly houseService: HouseService,
    private readonly mapService: MapService,
  ) {}

  async scheduleLobbies(socket: Server) {
    const lobbies = await this.lobbyService.findAllRunning();
    let promises = [];
    lobbies.forEach(async (lobby) => {
      promises.push(this.scheduleNextTurnForLobby(lobby.id, socket));
    });
    await Promise.all(promises);
    return HttpStatus.OK;
  }

  async scheduleNextTurnForLobby(lobbyId: string, socket: Server) {
    const lobby = await this.lobbyService.findOne(lobbyId);
    const { id, startTime, turnSchedule, turnCount } = lobby;
    const now = new Date();
    let nextTurnTime: Date | null = null;
    console.log(
      'Scheduling next turn for lobby',
      id,
      'at',
      startTime,
      'every',
      turnSchedule,
      'seconds for',
      turnCount,
      'turns',
    );
    for (let i = 0; i < turnCount; i++) {
      const turnTime = new Date(startTime.getTime() + i * turnSchedule * 1000);
      if (turnTime > now) {
        nextTurnTime = turnTime;
        break;
      }
    }

    if (nextTurnTime) {
      const jobName = `lobby_${id}_next_turn`;
      console.log(
        `Lobby ${id}, Next turn scheduled: ${nextTurnTime.toLocaleTimeString()}`,
      );
      this.scheduleCronJob(jobName, nextTurnTime, () => {
        this.nextTurnLobbyAction(lobby, socket);
        this.scheduleNextTurnForLobby(lobbyId, socket);
      });
    }
  }

  async nextTurnLobbyAction(lobby: Doc<Lobby>, socket: Server) {
    if (lobby === undefined) {
      return;
    }
    const map = await this.mapService.findOne(lobby.map);

    const houses = await this.houseService.findAllSellingFromLobby(lobby.id);
    for (const house of houses) {
      if (house.state !== houseState.OWNED) {
        let auction = house.auction;
        if (house.auction === 0) {
          // Selling to the bank.
          auction = house.price[house.level];
        }
        await this.serverService.playerMoneyTransaction(
          auction,
          house.owner !== '' ? house.owner : Bank.id,
          house.nextOwner !== '' ? house.nextOwner : Bank.id,
          transactionType.HOUSE_TRANSACTION,
          socket,
          true,
        );
        await this.houseService.findByIdAndUpdate(house.id, {
          owner: house.nextOwner,
          nextOwner: '',
          auction: 0,
          state: 'owned',
        });
      }
    }

    const players = await this.playerService.findAllFromLobby(lobby.id);
    for (const player of players) {
      if (!player.lost) {
        if (player.turnPlayed === false && player.actionPlayed === false) {
          const dice = this.playerService.generateDice(player);
          const { newPlayer } = await this.serverService.generatePath(
            dice,
            map,
            player,
          );
          await this.serverService.mandatoryAction(
            map,
            newPlayer.id,
            true,
            socket,
          );
        }
        if (
          player.turnPlayed === true &&
          player.actionPlayed === false &&
          map.cases[player.casePosition].type === CaseType.HOUSE
        ) {
          await this.serverService.mandatoryAction(
            map,
            player.id,
            true,
            socket,
          );
        }
        await this.playerService.findByIdAndUpdate(player.id, {
          turnPlayed: false,
          actionPlayed: false,
        });
      }
    }

    for (const player of players) {
      if (player.money < 0 && player.lost === false) {
        await this.playerService.findByIdAndUpdate(player.id, {
          money: 0,
          lost: true,
        });
        const targetSocketId = await this.serverService.getSocketId(
          player.user,
        );
        socket.to(targetSocketId).emit(GameEvent.LOST_GAME);
      }
    }

    const newLobby = await this.lobbyService.findByIdAndUpdate(lobby.id, {
      $inc: { turnCount: -1 },
    });

    if (newLobby.turnCount === 0) {
      const players = await this.playerService.findAllFromLobby(lobby.id);
      const houses = await this.houseService.findAllFromLobby(lobby.id);
      const leaderboard = [];
      for (const player of players) {
        let housesValue = 0;
        for (const houseIndex of player.houses) {
          const house = houses.find((e) => {
            return e.index === houseIndex;
          });
          for (let i = 0; i < house.level; i++) {
            housesValue += house.price[i];
          }
        }
        leaderboard.push({
          playerId: player.id,
          globalValue: housesValue + player.money,
        });
      }
      leaderboard.sort((a, b) => b.globalValue - a.globalValue);
      socket.to(lobby.id).emit(GameEvent.END_GAME, { leaderboard });
    }
  }

  private scheduleCronJob(name: string, date: Date, callback: () => void) {
    const job = new CronJob(date, callback);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }
}
