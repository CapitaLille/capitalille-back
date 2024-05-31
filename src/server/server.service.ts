import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
  forwardRef,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { HouseService } from 'src/house/house.service';
import { Lobby } from 'src/lobby/lobby.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import {
  Case,
  CaseEvent,
  CaseEventType,
  CaseType,
  Map,
} from 'src/map/map.schema';
import { MapService } from 'src/map/map.service';
import {
  Player,
  PlayerEvent,
  playerVaultType,
  transactionType,
} from 'src/player/player.schema';
import { Server } from 'socket.io';
import { PlayerService } from 'src/player/player.service';
import { ServerGuardSocket } from './server.gateway';
import {
  Bank,
  Doc,
  GameEvent,
  MoneyChangeData,
  PlayerSocketId,
} from './server.type';
import { House, houseState } from 'src/house/house.schema';
import { nanoid } from 'nanoid';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Injectable()
/**
 * Service class that handles server-related operations.
 */
export class ServerService {
  constructor(
    private readonly playerService: PlayerService,
    private readonly lobbyService: LobbyService,
    private readonly mapService: MapService,
    private readonly houseService: HouseService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  //#region Socket ID management
  socketIds: PlayerSocketId[] = [];

  async setSocketId(playerId: string, socketId: string) {
    const index = this.socketIds.findIndex(
      (pair) => pair.playerId === playerId,
    );
    if (index === -1) {
      this.socketIds.push({ playerId, socketId });
    } else {
      this.socketIds[index].socketId = socketId;
    }
    console.log(this.socketIds);
  }

  async removeSocketId(
    playerId: string = undefined,
    socketId: string = undefined,
  ) {
    if (playerId) {
      const index = this.socketIds.findIndex(
        (pair) => pair.playerId === playerId,
      );
      if (index !== -1) {
        this.socketIds.splice(index, 1);
      }
    } else if (socketId) {
      const index = this.socketIds.findIndex(
        (pair) => pair.socketId === socketId,
      );
      if (index !== -1) {
        this.socketIds.splice(index, 1);
      }
    }
    console.log('remove', this.socketIds);
  }

  async getSocketId(playerId: string) {
    const targetSocketId = this.socketIds.find(
      (pair) => pair.playerId === playerId,
    )?.socketId;
    if (!targetSocketId) {
      return nanoid(10);
    }
    return targetSocketId;
  }
  //#endregion

  /**
   * Create a game session and run a function with the lobby, player and map. If the function fails, the transaction is aborted.
   * @param lobbyId
   * @param userId
   * @param socket
   * @param run Function to run with the lobby, player and map fetched.
   */
  async gameSession(
    lobbyId: string,
    userId: string,
    socket: ServerGuardSocket | Server,
    run: (
      lobby: Doc<Lobby>,
      player: Doc<Player>,
      map: Doc<Map>,
    ) => Promise<void>,
  ) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const lobby = await this.lobbyService.findOne(lobbyId);
      if (!lobby) {
        throw new NotFoundException('Lobby not found');
      }
      const player = await this.playerService.findOne(userId, lobbyId);
      if (!player) {
        throw new NotFoundException('Player not found');
      }
      if (player.lost) {
        const targetSocketId = await this.getSocketId(player.user);
        socket
          .to(targetSocketId)
          .emit(GameEvent.LOST_GAME, { message: 'You lost' });
        throw new ForbiddenException('Player has lost');
      }
      const map = await this.mapService.findOne(lobby.map);
      if (!map) {
        throw new NotFoundException('Map not found');
      }
      await run(lobby, player, map);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.warn('Transaction failed: ' + error.message);
      throw new ForbiddenException('Transaction failed: ' + error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Generate a path for a player based on a dice roll and apply it to the player.
   *
   * @param dice The dice roll.
   * @param map The map.
   * @param player The player. WARNING: Make sure to update the player's properties (casePosition, money) within this function.
   * @returns The path generated, the player salary and the player updated.
   */
  async generatePath(
    dice: number,
    map: Doc<Map>,
    player: Doc<Player>,
  ): Promise<{
    path: Case[];
    salary: number;
    newPlayer: Doc<Player>;
  }> {
    const path: Case[] = [map.cases[player.casePosition]];
    let totalEarnThisTurn = 0;
    const playerSalary =
      this.playerService.ratingMultiplicator(player, map) *
      this.playerService.getPlayerSalary(player, map);
    for (let i = 0; i < dice; i++) {
      if (
        [CaseType.INTERSECTION, CaseType.START].includes(
          path[path.length - 1].type,
        )
      ) {
        totalEarnThisTurn += playerSalary;
        const direction = Math.round(Math.random());
        if (direction === 0) {
          const nextIndex = path[path.length - 1].next[0];
          path.push(map.cases[nextIndex]);
        } else if (direction === 1) {
          const nextIndex = path[path.length - 1].next[1];
          path.push(map.cases[nextIndex]);
        }
      } else {
        const nextIndex = path[path.length - 1].next[0];
        path.push(map.cases[nextIndex]);
      }
    }
    player.casePosition = map.cases.indexOf(path[path.length - 1]);
    const newPlayer = await this.playerService.findByIdAndUpdate(player.id, {
      casePosition: player.casePosition,
      turnPlayed: true,
      $inc: { money: totalEarnThisTurn },
    });
    return { path, salary: playerSalary, newPlayer };
  }

  /**
   * Make a mandatory action for a player based on the case they landed on.
   * @param map
   * @param player The player. WARNING: Make sure to update the player's properties (money) within this function.
   * @param socket
   */
  async mandatoryAction(
    map: Doc<Map>,
    playerId: string,
    autoPlay: boolean,
    socket: ServerGuardSocket | Server,
  ): Promise<CaseEventType | GameEvent> {
    const player = await this.playerService.findOneById(playerId);
    const type = map.cases[player.casePosition].type;
    try {
      switch (type) {
        case CaseType.BANK:
          if (player.bonuses.includes(playerVaultType.loan)) {
            const loanValue =
              map.configuration.bank.value +
              map.configuration.bank.tax *
                this.playerService.ratingMultiplicator(player, map) *
                map.configuration.bank.value;
            await this.playerMoneyTransaction(
              loanValue,
              player.id,
              Bank.id,
              transactionType.LOAN_REPAY,
              socket,
              true,
            );
            await this.playerService.findByIdAndUpdate(player.id, {
              $pull: { bonuses: playerVaultType.loan },
              turnPlayed: true,
              actionPlayed: true,
            });
            return GameEvent.BANK_LOAN_REFUND;
          }
          return GameEvent.BANK_LOAN_REQUEST;
        case CaseType.HOUSE:
          if (autoPlay) {
            // If it's a forced choice, player pay the house rent.
            const house = await this.houseService.findWithCase(
              player.casePosition,
              player.lobby,
            );
            if (house.owner !== player.id && house.owner !== '') {
              const cost = house.rent[house.level];
              // Pay rent
              await this.playerMoneyTransaction(
                cost,
                player,
                house.owner,
                transactionType.RENT,
                socket,
                true,
              );
            }
            await this.playerService.findByIdAndUpdate(player.id, {
              turnPlayed: true,
              actionPlayed: true,
            });
            return GameEvent.HOUSE_RENT_PAY;
          }
          return GameEvent.HOUSE_RENT_REQUEST;
        case CaseType.EVENT:
          const event = this.mapService.getRandomEvent();
          const gameEvent: CaseEventType = await this.mapEvent(
            event,
            player.id,
            autoPlay,
            socket,
          );
          return gameEvent;
        case CaseType.METRO:
          return GameEvent.METRO_REQUEST;
        case CaseType.BUS:
          return GameEvent.BUS_REQUEST;
        case CaseType.MONUMENTS:
          return GameEvent.MONUMENTS_REQUEST;
        case CaseType.COPS:
          return GameEvent.COPS_REQUEST;
        case CaseType.SCHOOL:
          return GameEvent.SCHOOL_REQUEST;
        default:
          await this.playerService.findByIdAndUpdate(player.id, {
            turnPlayed: true,
            actionPlayed: true,
          });
          return GameEvent.UNHANDLED_EVENT;
      }
    } catch (error) {
      throw new NotImplementedException('mandatoryAction : ' + error.message);
    }
  }

  /**
   * Transfer money from a player to another.
   * @param amount of money to transfer
   * @param type Type of transaction
   * @param socket Socket to emit the transaction
   * @param createTransactionDocument Create a transaction document (default: false)
   * @param announceFromPlayer Announce the transaction from the source player (default: true)
   * @param announceToPlayer Announce the transaction to the destination player (default: true)
   */
  async playerMoneyTransaction(
    amount: number,
    fromPlayer: Doc<Player> | string,
    toPlayer: Doc<Player> | string,
    type: transactionType,
    socket: ServerGuardSocket | Server,
    createTransactionDocument: boolean = false,
    announceFromPlayer: boolean = true,
    announceToPlayer: boolean = true,
  ) {
    if (fromPlayer === '' || toPlayer === '') {
      throw new BadRequestException('Player ID cannot be empty');
    }
    try {
      let newFromPlayer: Doc<Player>;
      let newToPlayer: Doc<Player>;
      if (typeof toPlayer === typeof '' && toPlayer !== Bank.id) {
        newToPlayer = await this.playerService.findOneById(toPlayer.toString());
      }
      if (typeof fromPlayer === typeof '' && fromPlayer !== Bank.id) {
        newFromPlayer = await this.playerService.findOneById(
          fromPlayer.toString(),
        );
      }

      if (typeof fromPlayer === typeof '' && fromPlayer !== Bank.id) {
        await this.playerService.findByIdAndUpdate(newFromPlayer.id, {
          $inc: { money: -amount },
        });
        if (announceFromPlayer) {
          const targetSocketId = 'ovk';
          //  await this.serverService.getSocketId(
          //   newFromPlayer.id,
          // );
          await socket
            .to(targetSocketId)
            .emit(
              GameEvent.MONEY_CHANGE,
              new MoneyChangeData(
                newFromPlayer?.id,
                newToPlayer?.id ? newToPlayer?.id : Bank.id,
                amount,
                type,
              ),
            );
        }
      }
      if (typeof toPlayer === typeof '' && toPlayer !== Bank.id) {
        await this.playerService.findByIdAndUpdate(newToPlayer.id, {
          $inc: { money: amount },
        });
        console.log(newToPlayer, 'newToPlayer', 'amount', amount, 'type', type);
        if (announceToPlayer) {
          const targetSocketId = 'ijei';
          //  await this.serverService.getSocketId(
          //   newToPlayer.id,
          // );
          socket
            .to(targetSocketId)
            .emit(
              GameEvent.MONEY_CHANGE,
              new MoneyChangeData(
                newFromPlayer?.id ? newFromPlayer?.id : Bank.id,
                newToPlayer.id,
                amount,
                type,
              ),
            );
        }
      }
      if (createTransactionDocument) {
        await this.playerService.generateTransaction(
          newFromPlayer.user,
          amount, // from player deduction
          newToPlayer.user,
          type,
        );
      }
      return HttpStatus.OK;
    } catch (error) {
      throw new NotImplementedException(
        'playerMoneyTransition : ' + error.message,
      );
    }
  }

  /**
   *
   * @param caseEventType
   * @param playerId
   * @param map
   */
  async mapEvent(
    caseEventType: CaseEventType,
    playerId: string,
    autoPlay: boolean,
    socket: ServerGuardSocket | Server,
  ): Promise<CaseEventType> {
    const player = await this.playerService.findOneById(playerId);
    switch (caseEventType) {
      case CaseEventType.DICE_DOUBLE:
        await this.playerService.findByIdAndUpdate(player.id, {
          $push: { bonuses: playerVaultType.dicePlus2 },
        });
        break;
      case CaseEventType.ELECTRICITY_FAILURE:
        await this.houseService.setHouseFailure(
          player.id,
          'electricity',
          socket,
        );
        await this.playerService.findByIdAndUpdate(player.id, {
          turnPlayed: true,
          actionPlayed: true,
        });
        break;
      case CaseEventType.FIRE_FAILURE:
        await this.houseService.setHouseFailure(player.id, 'fire', socket);
        await this.playerService.findByIdAndUpdate(player.id, {
          turnPlayed: true,
          actionPlayed: true,
        });
        break;
      case CaseEventType.WATER_FAILURE:
        await this.houseService.setHouseFailure(player.id, 'water', socket);
        await this.playerService.findByIdAndUpdate(player.id, {
          turnPlayed: true,
          actionPlayed: true,
        });
        break;
      case CaseEventType.RENT_DISCOUNT:
        await this.playerService.findByIdAndUpdate(player.id, {
          $push: { bonuses: playerVaultType.rentDiscount },
          turnPlayed: true,
          actionPlayed: true,
        });
        break;
      case CaseEventType.CASINO:
        if (!autoPlay) {
          await this.playerService.findByIdAndUpdate(player.id, {
            $push: { bonuses: playerVaultType.casino_temp },
          });
        }
        break;
    }
    return caseEventType;
  }

  async mapEventAction(
    caseEventType: PlayerEvent,
    attachedId: string | number, // Potential houseIndex, playerId, etc.
    playerId: string,
    socket: ServerGuardSocket,
  ) {
    const player = await this.playerService.findOneById(playerId);
    if (!player.turnPlayed) {
      throw new ForbiddenException('You need to play your turn first.');
    }
    if (player.lost) {
      throw new ForbiddenException("You can't play, you lost");
    }
    switch (caseEventType) {
      case PlayerEvent.CASINO_GAMBLE:
        break;
      case PlayerEvent.MONUMENTS_PAY:
        break;
      case PlayerEvent.COPS_COMPLAINT:
        break;
      case PlayerEvent.SCHOOL_PAY:
        break;
      case PlayerEvent.BUS_PAY:
        break;
      case PlayerEvent.METRO_PAY:
        break;
      case PlayerEvent.HOUSE_RENT_PAY:
        break;
    }
  }
}
