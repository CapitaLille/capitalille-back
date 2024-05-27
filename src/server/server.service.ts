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
import { cp } from 'fs';
import mongoose, { Model } from 'mongoose';
import { HouseService } from 'src/house/house.service';
import { Lobby } from 'src/lobby/lobby.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import { Case, CaseType, Map } from 'src/map/map.schema';
import { MapService } from 'src/map/map.service';
import {
  Player,
  playerVaultType,
  transactionType,
} from 'src/player/player.schema';
import { PlayerService } from 'src/player/player.service';
import { ServerGuardSocket } from './server.gateway';
import {
  Bank,
  Doc,
  GameEvent,
  MoneyChangeData,
  PlayerSocketId,
} from './server.type';
import { House } from 'src/house/house.schema';
import { nanoid } from 'nanoid';

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

  async gameSession(
    lobbyId: string,
    userId: string,
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
   * Generate a dice roll for a player based on their bonuses.
   * @param player
   * @returns The dice roll.
   */
  generateDice(
    player: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      },
  ) {
    let dice =
      Math.floor(Math.random() * 6) +
      1 +
      Math.floor(Math.random() * 6) +
      1 +
      Math.floor(Math.random() * 6) +
      1;
    for (const bonus of player.bonuses) {
      switch (bonus) {
        case playerVaultType.diceDouble:
          dice *= 2;
          break;
        case playerVaultType.diceDividedBy2:
          dice /= 2;
          break;
        case playerVaultType.diceMinus2:
          dice -= 2;
          break;
        case playerVaultType.dicePlus2:
          dice += 2;
          break;
      }
      dice = Math.round(dice);
      if (dice < 0) dice = 0;
    }
    return dice;
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
      this.ratingMultiplicator(player, map) * this.getPlayerSalary(player, map);
    for (let i = 0; i < dice; i++) {
      if (path[path.length - 1].type === CaseType.INTERSECTION) {
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
    player: Doc<Player>,
    socket: ServerGuardSocket,
  ) {
    const type = map.cases[player.casePosition].type;
    switch (type) {
      case CaseType.BANK:
        if (player.bonuses.includes(playerVaultType.loan)) {
          // Pay the loan
        }
      case CaseType.HOUSE:
        const house = await this.houseService.findWithCase(
          player.casePosition,
          player.lobby,
        );
        if (!player.houses.includes(house.index)) {
          const cost = house.rent[house.level];
          // Pay rent
          await this.playerMoneyTransaction(
            cost,
            player,
            house.owner,
            transactionType.RENT,
            socket,
            true,
            false,
          );
        }
    }
  }

  /**
   * Calculate multiplicator base on the player rating and the map configuration.
   */
  ratingMultiplicator(
    player: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      },
    map: mongoose.Document<unknown, {}, Map> &
      Map & {
        _id: mongoose.Types.ObjectId;
      },
  ): number {
    const rating = player.rating; // Rating 0-5 (2.5 Normal)
    const multiplicator = map.configuration.ratingMultiplicator; // [0.8, 1.2]
    const multiplicatorRange = multiplicator[1] - multiplicator[0]; // 0.4
    const ratingMultiplicator =
      (rating / 5) * multiplicatorRange + multiplicator[0];
    return ratingMultiplicator;
  }

  getPlayerSalary(
    player: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      },
    map: mongoose.Document<unknown, {}, Map> &
      Map & {
        _id: mongoose.Types.ObjectId;
      },
  ): number {
    const diplomeCount = player.bonuses.filter(
      (bonus) => bonus === playerVaultType.diploma,
    ).length;
    return (
      map.configuration.salary + map.configuration.diplomeBonus * diplomeCount
    );
  }

  /**
   * Get accessible cases from a player position for a specific map.
   * @param map
   * @param playerPosition
   * @returns
   */
  getNearestCases(map: Doc<Map>, playerPosition: number): number[] {
    const cases = map.cases;
    const nearestCases = [playerPosition];
    let next = cases[playerPosition].next;
    let last = cases[playerPosition].last;

    for (let i = 0; i < map.configuration.playerRange; i++) {
      nearestCases.push(...next);
      nearestCases.push(...last);
      let newNext = [];
      let newLast = [];
      for (let j = 0; j < next.length; j++) {
        newNext.push(...cases[next[j]].next);
      }
      for (let j = 0; j < last.length; j++) {
        newLast.push(...cases[last[j]].last);
      }
      next = newNext;
      last = newLast;
    }
    return nearestCases;
  }

  getAuctionPrice(map: Doc<Map>, house: Doc<House>) {
    if (house.auction === 0) {
      return house.price[house.level];
    }
    return Math.round(
      house.auction +
        (map.configuration.auctionStepPourcent * house.auction) / 100,
    );
  }

  /**
   * Generate a transaction DOCUMENT between two players.
   * @param fromPlayerId
   * @param amount of money to transfer.
   * @param targetPlayerId
   * @param type
   * @returns
   */
  async playerGenerateTransaction(
    fromPlayerId: string,
    amount: number,
    targetPlayerId: string,
    type: transactionType,
  ) {
    try {
      if (amount <= 0) {
        throw new ForbiddenException(
          'Transaction amount must be positive and non-zero.',
        );
      }
      // If the sender is the bank, we don't need to update the sender player.
      if (fromPlayerId !== Bank.id) {
        const player = await this.playerService.findOneById(fromPlayerId);
        if (!player) {
          return undefined;
        }
        await this.playerService.findByIdAndUpdate(player.id, {
          $push: { transactions: { amount, playerId: targetPlayerId, type } },
        });
      }
      // If the target is the bank, we don't need to update the target player.
      if (targetPlayerId !== Bank.id) {
        const targetPlayer =
          await this.playerService.findOneById(targetPlayerId);
        if (!targetPlayer) {
          return undefined;
        }
        await this.playerService.findByIdAndUpdate(targetPlayer.id, {
          $push: { transactions: { amount, playerId: fromPlayerId, type } },
        });
      }
    } catch (error) {
      console.error('playerGenerateTransaction : ' + error.message);
      throw new NotImplementedException(
        'playerGenerateTransaction : ' + error.message,
      );
    }
  }

  /**
   * Transfer money from a player to another.
   * @param amount of money to transfer
   * @param type Type of transaction
   * @param socket Socket to emit the transaction
   * @param announceFromPlayer Announce the transaction from the source player
   * @param announceToPlayer Announce the transaction to the destination player
   */
  async playerMoneyTransaction(
    amount: number,
    fromPlayer: Doc<Player> | string,
    toPlayer: Doc<Player> | string,
    type: transactionType,
    socket: ServerGuardSocket,
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
        await this.playerGenerateTransaction(
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
}
