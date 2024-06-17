import {
  HttpStatus,
  Inject,
  Injectable,
  UseInterceptors,
  forwardRef,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Server } from 'socket.io';
import { houseState } from 'src/house/house.schema';
import { HouseService } from 'src/house/house.service';
import { Lobby } from 'src/lobby/lobby.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import { MapService } from 'src/map/map.service';
import { moneyTransactionType } from 'src/player/player.schema';
import { PlayerService } from 'src/player/player.service';
import { ServerService } from 'src/server/server.service';
import { Doc, Bank, GameEvent } from 'src/server/server.type';
import { AchievementType } from 'src/user/user.schema';
import { UserService } from 'src/user/user.service';
import { ServerGateway } from './server.gateway';

@Injectable()
export class SchedulerService {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    private readonly lobbyService: LobbyService,
    private readonly serverService: ServerService,
    @Inject(forwardRef(() => ServerGateway))
    private readonly serverGateway: ServerGateway,
    private readonly userService: UserService,
    private readonly playerService: PlayerService,
    private readonly houseService: HouseService,
    private readonly mapService: MapService,
  ) {}

  async scheduleLobbies(socket: Server) {
    const lobbies = await this.lobbyService.findAllRunning();
    const promises = [];
    lobbies.forEach(async (lobby) => {
      promises.push(this.scheduleNextTurnForLobby(lobby.id, socket));
    });
    await Promise.all(promises);
    return HttpStatus.OK;
  }

  async scheduleNextTurnForLobby(lobbyId: string, socket: Server) {
    const lobby = await this.lobbyService.findOne(lobbyId);
    const { id, startTime, turnSchedule, turnCount } = lobby;
    if (turnCount <= 0) {
      console.log(
        'Not launching scheduler for lobby',
        id,
        'because turnCount is ' + turnCount,
      );
      return;
    }
    if (!lobby.started) {
      console.log(
        'Not launching scheduler for lobby',
        id,
        'because lobby has not started',
      );
      return;
    }
    const now = new Date();
    let nextTurnIndex: number = 0;
    let nextTurnTime: Date | null = null;
    let turnTime = new Date(startTime.getTime());
    let i = 0;
    while (turnTime < now) {
      i++;
      turnTime = new Date(startTime.getTime() + i * turnSchedule * 1000);
      nextTurnIndex = i;
      nextTurnTime = turnTime;
    }

    if (nextTurnTime) {
      const jobName = `lobby_${id}_next_turn_${nextTurnIndex}`;
      console.log(
        `Lobby ${id}, Next turn scheduled: ${nextTurnTime.toLocaleTimeString()}`,
      );
      this.scheduleCronJob(jobName, nextTurnTime, () => {
        this.nextTurnLobbyAction(lobby);
        this.scheduleNextTurnForLobby(lobbyId, socket);
      });
    } else {
      console.log('Lobby ended');
      const leaderboard = await this.setLeaderboard(lobby);
      this.lobbyService.findByIdAndUpdate(lobbyId, {
        turnCount: 0,
      });
    }
  }

  async setLeaderboard(lobby: Doc<Lobby>) {
    const newLobby = await this.lobbyService.findOne(lobby.id);
    const players = await this.playerService.findAllFromLobby(lobby.id);
    const houses = await this.houseService.findAllFromLobby(lobby.id);
    const leaderboard = [];
    for (const player of players) {
      this.userService.statisticsUpdate(player.user, AchievementType.playGame);
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
        value: housesValue + player.money,
        trophies: 0,
      });
    }
    leaderboard.sort((a, b) => b.globalValue - a.globalValue);
    const trophies = newLobby.users.length * 100;
    for (let i = 0; i < leaderboard.length; i++) {
      const multiplicator =
        ((leaderboard.length - 1) / 2 - i) / (leaderboard.length - 1);
      leaderboard[i].trophies = trophies * multiplicator;
    }
    const newLobby2 = await this.lobbyService.findByIdAndUpdate(lobby.id, {
      turnCount: 0,
      leaderboard: leaderboard,
    });
    return leaderboard;
  }

  async nextTurnLobbyAction(lobby: Doc<Lobby>) {
    const socket = this.serverGateway.getServer();
    await socket.emit(GameEvent.ERROR, { message: 'Next turn action' });
    if (lobby === undefined) {
      return;
    }
    const map = await this.mapService.findOne(lobby.map);
    const players = await this.playerService.findAllFromLobby(lobby.id);

    for (const player of players) {
      if (!player.lost) {
        if (player.turnPlayed === false) {
          const dice = this.playerService.generateDice(
            player,
            this.serverGateway.getServer(),
          );
          const { newPlayer } = await this.serverService.generatePath(
            dice.diceValue,
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
        if (player.turnPlayed === true && player.actionPlayed === false) {
          await this.serverService.mandatoryAction(
            map,
            player.id,
            true,
            socket,
          );
        }
        await this.playerService.findByIdAndUpdate(
          player.id,
          {
            turnPlayed: false,
            actionPlayed: false,
          },
          this.serverGateway.getServer(),
        );
      }
    }

    const houses = await this.houseService.findAllFromLobby(lobby.id);
    for (const house of houses) {
      if (house.state === houseState.SALE) {
        let auction = house.auction;
        const promises = [];
        if (house.auction === 0) {
          // Nobody make an auction. Selling to the bank.
          auction = house.price[house.level];
        }
        if (house.nextOwner !== '') {
          promises.push(
            this.userService.statisticsUpdate(
              house.nextOwner,
              AchievementType.auctionWinner,
            ),
          );
        }
        promises.push(
          this.serverService.playerMoneyTransaction(
            auction,
            house.owner !== '' ? house.owner : Bank.id,
            house.nextOwner !== '' ? house.nextOwner : Bank.id,
            moneyTransactionType.HOUSE_TRANSACTION,
            socket,
            {
              socketEmitSourcePlayer: false,
              socketEmitTargetPlayer: false,
              forceTransaction: true,
              createTransactionDocument: true,
            },
          ),
        );
        promises.push(
          this.houseService.findByIdAndUpdate(
            house.id,
            {
              owner: house.nextOwner,
              nextOwner: '',
              auction: 0,
              state:
                house.nextOwner !== '' ? houseState.OWNED : houseState.FREE,
            },
            this.serverGateway.getServer(),
          ),
        );
        await Promise.all(promises);
      }
      if (house.state === houseState.FREE) {
        const auction = house.auction;
        if (house.nextOwner !== '') {
          const promises = [];
          promises.push(
            this.userService.statisticsUpdate(
              house.nextOwner,
              AchievementType.auctionWinner,
            ),
          );
          promises.push(
            this.serverService.playerMoneyTransaction(
              auction,
              house.owner !== '' ? house.owner : Bank.id,
              house.nextOwner !== '' ? house.nextOwner : Bank.id,
              moneyTransactionType.HOUSE_TRANSACTION,
              socket,
              {
                socketEmitSourcePlayer: false,
                socketEmitTargetPlayer: false,
                forceTransaction: true,
                createTransactionDocument: true,
              },
            ),
          );
          promises.push(
            this.houseService.findByIdAndUpdate(
              house.id,
              {
                owner: house.nextOwner,
                nextOwner: '',
                auction: 0,
                state: houseState.OWNED,
              },
              this.serverGateway.getServer(),
            ),
          );
          await Promise.all(promises);
        }
      }
      if (house.state === houseState.OWNED && house.owner.length === 0) {
        // Fix house state if owner is empty
        await this.houseService.findByIdAndUpdate(
          house.id,
          {
            state: houseState.FREE,
            auction: 0,
          },
          this.serverGateway.getServer(),
        );
      }
      if (house.nextLevel !== house.level) {
        await this.houseService.findByIdAndUpdate(
          house.id,
          {
            level: house.nextLevel,
          },
          this.serverGateway.getServer(),
        );
      }
    }

    for (const player of players) {
      if (player.money < 0 && player.lost === false) {
        await this.playerService.findByIdAndUpdate(
          player.id,
          {
            money: 0,
            lost: true,
          },
          this.serverGateway.getServer(),
        );
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
      const leaderboard = await this.setLeaderboard(newLobby);
      socket.in(lobby.id).emit(GameEvent.END_GAME, { leaderboard });
    }
  }

  private scheduleCronJob(name: string, date: Date, callback: () => void) {
    const job = new CronJob(date, callback);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }
}
