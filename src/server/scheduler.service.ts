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
import {
  moneyTransactionType,
  playerVaultType,
} from 'src/player/player.schema';
import { PlayerService } from 'src/player/player.service';
import { ServerService } from 'src/server/server.service';
import { Doc, Bank, GameEvent, publicServer } from 'src/server/server.type';
import { AchievementType } from 'src/user/user.schema';
import { UserService } from 'src/user/user.service';
import { ServerGateway } from './server.gateway';
import { HistoryService } from 'src/history/history.service';
import { Create } from 'sharp';
import { CreateLobbyDto } from 'src/lobby/dto/create-lobby.dto';

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
    private readonly historyService: HistoryService,
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

  async launchPublicLobbies() {
    const lobbies = await this.lobbyService.findAllPublicRunning();
    const promises = [];
    if (lobbies.length < publicServer.limit) {
      const lobbyToGenerate = publicServer.limit - lobbies.length;
      const map = await this.mapService.findAll();
      const missingMap = map.filter((e) => {
        return !lobbies.some((l) => l.map === e.id);
      });
      const turnSchedules = lobbies.map((e) => e.turnSchedule);
      const missingTurnSchedules = publicServer.turnSchedule.filter((e) => {
        return !turnSchedules.includes(e);
      });
      for (let i = 0; i < lobbyToGenerate; i++) {
        const lobbyDto: CreateLobbyDto = {
          map: missingMap.length > 0 ? missingMap[0].id : map[0].id,
          turnSchedule:
            missingTurnSchedules.length > 0
              ? missingTurnSchedules[0]
              : publicServer.turnSchedule[0],
          turnCountMax: publicServer.turnCountMax[1],
          users: [],
        };
        promises.push(this.lobbyService.createPublic(lobbyDto));
      }
    }
    await Promise.all(promises);
    return HttpStatus.OK;
  }

  async getDelay(lobbyId: string) {
    const lobby = await this.lobbyService.findOne(lobbyId);
    const { startTime, turnSchedule, turnCount } = lobby;
    if (turnCount <= 0) {
      return 0;
    }
    if (!lobby.started) {
      return 0;
    }
    let now = new Date();
    let nextTurnTime: Date | null = null;
    let turnTime = new Date(startTime.getTime());
    let i = 0;
    while (turnTime < now) {
      console.log('turnTime', turnTime.toISOString(), turnSchedule);
      now = new Date();
      i++;
      turnTime = new Date(startTime.getTime() + i * turnSchedule * 1000);
      nextTurnTime = turnTime;
    }
    return new Date(nextTurnTime).getTime() - new Date().getTime();
  }

  async scheduleNextTurnForLobby(lobbyId: string, socket: Server) {
    const lobby = await this.lobbyService.findOne(lobbyId);
    const { startTime, turnSchedule, turnCount } = lobby;
    if (turnCount <= 0) {
      return;
    }
    if (!lobby.started) {
      return;
    }
    let now = new Date();
    let nextTurnIndex: number = 0;
    let nextTurnTime: Date | null = null;
    let turnTime = new Date(startTime.getTime());
    let i = 0;
    while (turnTime < now) {
      now = new Date();
      i++;
      turnTime = new Date(startTime.getTime() + i * turnSchedule * 1000);
      nextTurnIndex = i;
      nextTurnTime = turnTime;
    }

    if (nextTurnTime) {
      const jobName = `lobby_${lobby.id}_next_turn_${nextTurnIndex}`;
      console.log(
        `Lobby ${lobby.id}, Next turn scheduled: ${nextTurnTime.toISOString()}`,
      );
      socket.in(lobby.id).emit(GameEvent.NEXT_TURN, {
        delay: nextTurnTime.getTime() - new Date().getTime(),
      });
      this.scheduleCronJob(jobName, nextTurnTime, () => {
        this.nextTurnLobbyAction(lobby);
        this.scheduleNextTurnForLobby(lobbyId, socket);
      });
    } else {
      const leaderboard = await this.setLeaderboard(lobby);
      socket.in(lobby.id).emit(GameEvent.END_GAME, { leaderboard });
    }
  }

  async scheduleDeleteLobby(lobbyId: string) {
    const lobby = await this.lobbyService.findOne(lobbyId);
    const jobName = `lobby_${lobbyId}_delete`;
    // In 24h
    const deleteAfter = 30 * 1000;
    const deleteTime = new Date(new Date().getTime() + deleteAfter);
    if (lobby.turnCount <= 0) {
      console.log(`Lobby ${lobbyId} scheduled for deletion`);
      this.scheduleCronJob(jobName, deleteTime, async () => {
        await this.lobbyService.deleteLobby(lobbyId);
        if (lobby.private) {
          await this.launchPublicLobbies();
        }
      });
    }
  }

  async setLeaderboard(
    lobby: Doc<Lobby>,
  ): Promise<{ playerId: string; value: number; trophies: number }[]> {
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
    leaderboard.sort((a, b) => a.globalValue - b.globalValue);
    const trophies = newLobby.users.length * 100;
    for (let i = 0; i < leaderboard.length; i++) {
      let multiplicator =
        ((leaderboard.length - 1) / 2 - i) / (leaderboard.length - 1);
      multiplicator = Number.isNaN(multiplicator) ? 0 : multiplicator;
      console.log(multiplicator);
      console.log(trophies);
      leaderboard[i].trophies = trophies * multiplicator;
    }
    for (const player of players) {
      const user = await this.userService.findOne(player.user);
      const userTrophies =
        user.trophies +
        leaderboard.find((e) => e.playerId === player.id).trophies;
      if (userTrophies >= 0) {
        await this.userService.findByIdAndUpdate(player.user, {
          $inc: {
            trophies: leaderboard.find((e) => e.playerId === player.id)
              .trophies,
          },
        });
      } else {
        await this.userService.findByIdAndUpdate(player.user, {
          trophies: 0,
        });
      }
    }

    const newLobby2 = await this.lobbyService.findByIdAndUpdate(
      lobby.id,
      {
        leaderboard: leaderboard,
      },
      this.serverGateway.getServer(),
    );
    return leaderboard;
  }

  async nextTurnLobbyAction(lobby: Doc<Lobby>) {
    const socket = this.serverGateway.getServer();
    if (lobby === undefined) {
      return;
    }

    const map = await this.mapService.findOne(lobby.map);
    const players = await this.playerService.findAllFromLobby(lobby.id);

    for (const player of players) {
      if (!player.lost) {
        if (player.turnPlayed === false) {
          const dice = await this.playerService.generateDice(
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
            $pull: { bonuses: playerVaultType.casino_temp },
          },
          this.serverGateway.getServer(),
        );
      }
    }

    const houses = await this.houseService.findAllFromLobby(lobby.id);
    for (const house of houses) {
      if (house.state === houseState.SALE) {
        const auction =
          house.auction === 0 ? house.price[house.level] : house.auction;
        const owner = house.owner;
        const nextOwner = house.nextOwner;
        const promises = [];

        if (nextOwner !== '') {
          promises.push(
            this.userService.statisticsUpdate(
              nextOwner,
              AchievementType.auctionWinner,
            ),
          );
        }
        promises.push(
          await this.serverService.playerMoneyTransaction(
            auction,
            Bank.id,
            owner,
            moneyTransactionType.HOUSE_TRANSACTION,
            {
              createTransactionDocument: false,
              forceTransaction: true,
            },
          ),
        );
        promises.push(
          this.playerService.generateTransaction(
            nextOwner !== '' ? nextOwner : Bank.id,
            owner,
            auction,
            moneyTransactionType.HOUSE_TRANSACTION,
            this.serverGateway.getServer(),
          ),
        );
        promises.push(
          this.houseService.findByIdAndUpdate(
            house.id,
            {
              owner: nextOwner,
              nextOwner: '',
              auction: 0,
              state: nextOwner !== '' ? houseState.OWNED : houseState.FREE,
            },
            this.serverGateway.getServer(),
          ),
        );
        promises.push(
          this.playerService.findByIdAndUpdate(
            owner,
            {
              $pull: { houses: house.index },
            },
            this.serverGateway.getServer(),
          ),
        );
        promises.push(
          this.playerService.findByIdAndUpdate(
            nextOwner,
            {
              $push: { houses: house.index },
            },
            this.serverGateway.getServer(),
          ),
        );
        await Promise.all(promises);
      }
      if (house.state === houseState.FREE && house.nextOwner !== '') {
        const auction = house.auction;
        const nextOwner = house.nextOwner;
        const promises = [];
        promises.push(
          this.userService.statisticsUpdate(
            nextOwner,
            AchievementType.auctionWinner,
          ),
        );
        promises.push(
          this.playerService.generateTransaction(
            nextOwner,
            Bank.id,
            auction,
            moneyTransactionType.HOUSE_TRANSACTION,
            this.serverGateway.getServer(),
          ),
        );
        promises.push(
          this.houseService.findByIdAndUpdate(
            house.id,
            {
              owner: nextOwner,
              nextOwner: '',
              auction: 0,
              state: houseState.OWNED,
            },
            this.serverGateway.getServer(),
          ),
        );
        promises.push(
          this.playerService.findByIdAndUpdate(
            nextOwner,
            {
              $push: { houses: house.index },
            },
            this.serverGateway.getServer(),
          ),
        );
        await Promise.all(promises);
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
        const promises = [];
        promises.push(
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              money: 0,
              houses: [],
              lost: true,
            },
            this.serverGateway.getServer(),
          ),
        );
        promises.push(
          await this.houseService.freeHouseFromOwner(player.id, lobby.id),
        );
        const targetSocketId = await this.serverService.getSocketId(
          player.user,
        );
        socket.to(targetSocketId).emit(GameEvent.LOST_GAME);
      }
    }

    let newLobby = await this.lobbyService.findOne(lobby.id);
    if (lobby.turnCount > 0) {
      const turnCount = lobby.turnCount - 1 < 0 ? 0 : lobby.turnCount - 1;
      newLobby = await this.lobbyService.findByIdAndUpdate(
        lobby.id,
        {
          turnCount: turnCount,
        },
        this.serverGateway.getServer(),
      );
    }
    if (newLobby.turnCount <= 0) {
      const leaderboard = await this.setLeaderboard(newLobby);
      await this.historyService.create(
        players,
        newLobby,
        houses,
        map,
        leaderboard,
      );
      await this.scheduleDeleteLobby(newLobby.id);
      socket.in(lobby.id).emit(GameEvent.END_GAME, { leaderboard });
    }
  }

  private scheduleCronJob(name: string, date: Date, callback: () => void) {
    const job = new CronJob(date, callback);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }
}
