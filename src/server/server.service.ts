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
  moneyTransactionType,
  playerVaultType,
  ratingTransactionType,
} from 'src/player/player.schema';
import { Server } from 'socket.io';
import { PlayerService } from 'src/player/player.service';
import { ServerGuardSocket } from './server.gateway';
import {
  AuctionData,
  Bank,
  Doc,
  GameEvent,
  MoneyChangeData,
  PlayerSocketId,
  RatingChangeData,
} from './server.type';
import { House, houseState } from 'src/house/house.schema';
import { nanoid } from 'nanoid';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { UserService } from 'src/user/user.service';
import {
  Achievement,
  AchievementLevel,
  AchievementType,
} from 'src/user/user.schema';

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
    private readonly userService: UserService,
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
              moneyTransactionType.LOAN_REPAY,
              socket,
              {
                socketEmitSourcePlayer: false,
                socketEmitTargetPlayer: false,
                createTransactionDocument: true,
                forceTransaction: true,
              },
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
                moneyTransactionType.RENT,
                socket,
                {
                  socketEmitSourcePlayer: false,
                  socketEmitTargetPlayer: true,
                  createTransactionDocument: true,
                  forceTransaction: true,
                },
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
   * @param force Force the transaction even if the source player doesn't have enough money (default: false)
   * @param socketEmit Socket emit configuration (default: { fromPlayer: true, toPlayer: true })
   */
  async playerMoneyTransaction(
    amount: number,
    fromPlayer: Doc<Player> | string,
    toPlayer: Doc<Player> | string,
    type: moneyTransactionType,
    socket: ServerGuardSocket | Server,
    data: {
      socketEmitSourcePlayer: boolean;
      socketEmitTargetPlayer: boolean;
      createTransactionDocument: boolean;
      forceTransaction: boolean;
    } = {
      socketEmitSourcePlayer: true,
      socketEmitTargetPlayer: true,
      createTransactionDocument: false,
      forceTransaction: false,
    },
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
        if (!data.forceTransaction && newFromPlayer.money < amount) {
          const targetSocketId = await this.getSocketId(newToPlayer.id);
          socket.to(targetSocketId).emit(GameEvent.NOT_ENOUGH_MONEY);
          throw new ForbiddenException('Not enough money');
        }
      }

      if (typeof fromPlayer === typeof '' && fromPlayer !== Bank.id) {
        await this.playerService.findByIdAndUpdate(newFromPlayer.id, {
          $inc: { money: -amount },
        });
        if (data.socketEmitSourcePlayer) {
          const targetSocketId = await this.getSocketId(newFromPlayer.id);
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
        await this.userService.statisticsUpdate(
          newToPlayer.user,
          AchievementType.payMe,
        );
        console.log(newToPlayer, 'newToPlayer', 'amount', amount, 'type', type);
        if (data.socketEmitTargetPlayer) {
          const targetSocketId = await this.getSocketId(newToPlayer.id);
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
      if (data.createTransactionDocument) {
        await this.playerService.generateTransaction(
          newFromPlayer?.id ? newFromPlayer.id : Bank.id,
          amount, // from player deduction
          newToPlayer?.id ? newToPlayer.id : Bank.id,
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

  async playerRatingTransaction(
    amount: number,
    playerId: string,
    socket: ServerGuardSocket | Server,
  ) {
    const player = await this.playerService.findOneById(playerId);
    let newRating = player.rating + amount;
    if (newRating < 0) {
      newRating = 0;
    }
    if (newRating > 5) {
      newRating = 5;
    }
    const targetSocketId = await this.getSocketId(player.id);
    await socket
      .to(targetSocketId)
      .emit(
        GameEvent.RATING_CHANGE,
        new RatingChangeData(
          amount > 0 ? Bank.id : player.id,
          amount > 0 ? player.id : Bank.id,
          amount,
          ratingTransactionType.MONUMENTS_RATING,
        ),
      );
    return await this.playerService.findByIdAndUpdate(player.id, {
      rating: newRating,
    });
  }

  /**
   * Choose an event and apply it to the player.
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

  /**
   * In case of a player answering a case event.
   * @param caseEventType
   * @param attachedId
   * @param playerId
   * @param socket
   */
  async playerAction(
    caseEventType: PlayerEvent,
    attachedId: string | number, // Potential houseIndex, playerId, etc.
    playerId: string,
    socket: ServerGuardSocket,
  ) {
    const player = await this.playerService.findOneById(playerId);
    const lobby = await this.lobbyService.findOne(player.lobby);
    const map = await this.mapService.findOne(lobby.map);

    if (!player.turnPlayed) {
      throw new ForbiddenException('You need to play your turn first.');
    }
    if (player.lost) {
      throw new ForbiddenException(
        "You can't play anymore because you lost the game.",
      );
    }
    switch (caseEventType) {
      case PlayerEvent.CASINO_GAMBLE:
        await this.casinoGamble(player, map, socket);
        break;
      case PlayerEvent.MONUMENTS_PAY:
        await this.monumetsPay(player, map, socket);
        break;
      case PlayerEvent.COPS_COMPLAINT:
        await this.copsComplaint(playerId, attachedId as string, map, socket);
        break;
      case PlayerEvent.SCHOOL_PAY:
        await this.schoolPay(player, map, socket);
        break;
      case PlayerEvent.BUS_PAY:
        if (player.money < map.configuration.busPrice) {
          socket.emit(GameEvent.NOT_ENOUGH_MONEY);
          throw new ForbiddenException('Not enough money');
        }
        await this.playerMoneyTransaction(
          map.configuration.busPrice,
          player.id,
          Bank.id,
          moneyTransactionType.BUS,
          socket,
          {
            socketEmitSourcePlayer: true,
            socketEmitTargetPlayer: true,
            createTransactionDocument: true,
            forceTransaction: false,
          },
        );
        await this.teleportPlayer(player.id, socket);
        break;
      case PlayerEvent.METRO_PAY:
        if (player.money < map.configuration.metroPrice) {
          socket.emit(GameEvent.NOT_ENOUGH_MONEY);
          throw new ForbiddenException('Not enough money');
        }
        await this.playerMoneyTransaction(
          map.configuration.metroPrice,
          player.id,
          Bank.id,
          moneyTransactionType.METRO,
          socket,
          {
            socketEmitSourcePlayer: true,
            socketEmitTargetPlayer: true,
            createTransactionDocument: true,
            forceTransaction: false,
          },
        );
        await this.teleportPlayer(player.id, socket);
        break;
      case PlayerEvent.HOUSE_RENT_PAY:
        await this.houseRent(player, attachedId as number, map, socket, false);
        break;
      case PlayerEvent.HOUSE_RENT_FRAUD:
        await this.houseRent(player, attachedId as number, map, socket, true);
        break;
      case PlayerEvent.BUY_AUCTION:
        await this.buyAuctionHouse(
          lobby,
          player,
          attachedId as number,
          map,
          socket,
        );
        break;
    }
  }

  async buyAuctionHouse(
    lobby: Doc<Lobby>,
    player: Doc<Player>,
    houseIndex: number,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const house = await this.houseService.findOne(lobby.id, houseIndex);
    const nearestCases = this.mapService.getNearestCases(
      map,
      player.casePosition,
    );
    if (
      !nearestCases.some((element) =>
        map.houses[houseIndex].cases.includes(element),
      )
    ) {
      socket.emit(GameEvent.ERROR, {
        message: 'House is too far away',
      });
      throw new ForbiddenException(
        'House is too far away, nearest : ' +
          nearestCases.join(', ') +
          '. Player pos : ' +
          player.casePosition +
          '. House pos : ' +
          map.houses[houseIndex].cases.join(','),
      );
    }
    if (house.state !== 'free' && house.state !== 'sale') {
      socket.emit(GameEvent.ERROR, {
        message: 'House is not for sale',
      });
      throw new ForbiddenException('House is not for sale');
    }
    const actualAuction = house.auction;
    const newAuction = this.houseService.getAuctionPrice(map, house);
    if (player.money < newAuction) {
      socket.emit(GameEvent.ERROR, {
        message: 'Player does not have enough money',
      });
      throw new ForbiddenException('Player does not have enough money');
    }
    let promises = [];

    if (house.nextOwner !== '') {
      console.log('refund', house.nextOwner, house.auction);
      promises.push(
        this.playerMoneyTransaction(
          house.auction,
          Bank.id,
          house.nextOwner,
          moneyTransactionType.AUCTION,
          socket,
          {
            socketEmitSourcePlayer: true,
            socketEmitTargetPlayer: true,
            createTransactionDocument: false,
            forceTransaction: true,
          },
        ),
      );
    }
    promises.push(
      this.playerMoneyTransaction(
        newAuction,
        player.id,
        Bank.id,
        moneyTransactionType.AUCTION,
        socket,
        {
          socketEmitSourcePlayer: true,
          socketEmitTargetPlayer: true,
          createTransactionDocument: false,
          forceTransaction: true,
        },
      ),
    );
    await Promise.all(promises);

    const targetSocketId = await this.getSocketId(house.nextOwner);

    promises = [];
    promises.push(
      this.houseService.findByIdAndUpdate(
        house.id,
        {
          nextOwner: player.id,
          auction: newAuction,
        },
        socket,
      ),
    );
    promises.push(
      socket
        .to(targetSocketId)
        .emit(
          GameEvent.AUCTION_EXIT,
          new AuctionData(houseIndex, player.id, newAuction),
        ),
    );
    promises.push(
      socket
        .to(lobby.id)
        .emit(
          GameEvent.AUCTION_SET,
          new AuctionData(houseIndex, player.user, newAuction),
        ),
    );
    promises.push(
      this.userService.statisticsUpdate(
        player.user,
        AchievementType.auctionBuyer,
      ),
    );
    await Promise.all(promises);
  }

  async casinoGamble(
    player: Doc<Player>,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const random = Math.random();
    await this.playerMoneyTransaction(
      map.configuration.casino.value,
      player.id,
      Bank.id,
      moneyTransactionType.CASINO,
      socket,
      {
        socketEmitSourcePlayer: true,
        socketEmitTargetPlayer: true,
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    const { chance, value } = map.configuration.casino;
    const targetSocketId = await this.getSocketId(player.id);
    if (random < chance) {
      const money = (1 / chance) * value;
      await socket.to(targetSocketId).emit(GameEvent.CASINO_WIN);
      await this.playerMoneyTransaction(
        money,
        Bank.id,
        player.id,
        moneyTransactionType.CASINO,
        socket,
        {
          socketEmitSourcePlayer: true,
          socketEmitTargetPlayer: true,
          createTransactionDocument: true,
          forceTransaction: false,
        },
      );
    } else {
      await socket.to(targetSocketId).emit(GameEvent.CASINO_LOST);
    }
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.gambler,
    );
  }

  async monumetsPay(
    player: Doc<Player>,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const monument = map.monuments.find((e) => {
      if (e.cases.includes(player.casePosition)) {
        return true;
      }
    });
    if (player.money < monument.price) {
      socket.emit(GameEvent.NOT_ENOUGH_MONEY);
      throw new ForbiddenException('Not enough money');
    }
    await this.playerMoneyTransaction(
      monument.price,
      player.id,
      Bank.id,
      moneyTransactionType.MONUMENTS_PAY,
      socket,
      {
        socketEmitSourcePlayer: true,
        socketEmitTargetPlayer: true,
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    await this.playerRatingTransaction(monument.bonus, player.id, socket);
    await this.playerService.generateTransaction(
      Bank.id,
      monument.bonus,
      player.id,
      ratingTransactionType.MONUMENTS_RATING,
    );
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.monumentsRestorer,
    );
  }

  async houseRent(
    player: Doc<Player>,
    houseIndex: number,
    map: Doc<Map>,
    socket: ServerGuardSocket,
    fraud: boolean = false,
  ) {
    const house = await this.houseService.findOne(player.lobby, houseIndex);
    const cost = house.rent[house.level];
    if (fraud) {
      const random = Math.random();
      if (random < map.configuration.fraudChance) {
        await this.playerService.generateTransaction(
          player.id,
          0,
          house.owner,
          moneyTransactionType.RENT_FRAUD,
        );
        await this.userService.statisticsUpdate(
          player.user,
          AchievementType.frauder,
        );
        return;
      } else {
        await this.playerMoneyTransaction(
          cost * 2,
          player.id,
          house.owner,
          moneyTransactionType.RENT_FINED,
          socket,
          {
            socketEmitSourcePlayer: true,
            socketEmitTargetPlayer: true,
            createTransactionDocument: true,
            forceTransaction: true,
          },
        );
        return;
      }
    }
    await this.playerMoneyTransaction(
      cost,
      player.id,
      house.owner,
      moneyTransactionType.RENT,
      socket,
      {
        socketEmitSourcePlayer: true,
        socketEmitTargetPlayer: true,
        createTransactionDocument: true,
        forceTransaction: true,
      },
    );
  }

  async copsComplaint(
    sourcePlayerId: string,
    targetPlayerId: string,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const cops = map.configuration.copsMalus;
    await this.playerRatingTransaction(-cops, targetPlayerId, socket);
    const targetSocketId = await this.getSocketId(targetPlayerId);
    await socket
      .to(targetSocketId)
      .emit(
        GameEvent.RATING_CHANGE,
        new RatingChangeData(
          sourcePlayerId,
          targetPlayerId,
          cops,
          ratingTransactionType.COPS_RATING,
        ),
      );
    await this.playerService.generateTransaction(
      sourcePlayerId,
      cops,
      targetPlayerId,
      ratingTransactionType.COPS_RATING,
    );
    const sourcePlayer = await this.playerService.findOneById(sourcePlayerId);
    await this.userService.statisticsUpdate(
      sourcePlayer.user,
      AchievementType.copsComplainer,
    );
  }

  async schoolPay(
    player: Doc<Player>,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    if (player.money < map.configuration.school.cost) {
      socket.emit(GameEvent.NOT_ENOUGH_MONEY);
      throw new ForbiddenException('Not enough money');
    }
    await this.playerMoneyTransaction(
      map.configuration.school.cost,
      player.id,
      Bank.id,
      moneyTransactionType.SCHOOL,
      socket,
      {
        socketEmitSourcePlayer: true,
        socketEmitTargetPlayer: true,
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    await this.playerService.findByIdAndUpdate(player.id, {
      $push: { bonuses: playerVaultType.diploma },
    });
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.student,
    );
  }

  async teleportPlayer(playerId: string, socket: ServerGuardSocket) {
    const player = await this.playerService.findOneById(playerId);
    const lobby = await this.lobbyService.findOne(player.lobby);
    const map = await this.mapService.findOne(lobby.map);
    const targetCaseIndex = map.cases[player.casePosition].nextStationCaseIndex;
    await this.playerService.findByIdAndUpdate(player.id, {
      casePosition: targetCaseIndex,
    });
    const targetSocketId = await this.getSocketId(player.id);
    await socket.to(targetSocketId).emit(GameEvent.PLAYER_UPDATE, { player });
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.teleport,
    );
  }
}
