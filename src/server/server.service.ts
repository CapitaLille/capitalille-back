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
import { ServerGateway, ServerGuardSocket } from './server.gateway';
import {
  Bank,
  Doc,
  GameEvent,
  InfoSocket,
  PlayerSocketId,
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
import {
  build,
  checkmark,
  close,
  hammer,
  handLeft,
  paperPlane,
  ticket,
  ticketOutline,
  trophy,
  wallet,
} from 'src/ion-icon';
import { response } from 'express';
import { ANSWER } from './server.response';

export interface extendedCase extends Case {
  index: number;
}

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
    @Inject(forwardRef(() => ServerGateway))
    private readonly serverGateway: ServerGateway,
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
    checkEndGame: boolean = true,
    checkLost: boolean = true,
    checkTurnPlayed: boolean = true,
  ) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const lobby = await this.lobbyService.findOne(lobbyId);
      if (!lobby) {
        throw new NotFoundException('Lobby not found');
      }
      if (checkEndGame && lobby.turnCount <= 0) {
        throw new ForbiddenException('Game is over');
      }
      const player = await this.playerService.findOneByUserId(
        userId,
        lobbyId,
        '+transactions',
      );
      if (!player) {
        throw new NotFoundException("Votre joueur n'a pas été trouvé");
      }
      if (!player.turnPlayed && checkTurnPlayed) {
        throw new ForbiddenException(
          "Vous devez jouer avant d'effectuer cette action",
        );
      }
      if (player.lost && checkLost) {
        const targetSocketId = await this.getSocketId(player.user);
        socket
          .to(targetSocketId)
          .emit(GameEvent.LOST_GAME, { message: 'You lost' });
        throw new ForbiddenException('Vous avez perdu la partie');
      }
      const map = await this.mapService.findOne(lobby.map);
      if (!map) {
        throw new NotFoundException("La carte n'a pas été trouvée");
      }
      await run(lobby, player, map);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      console.warn('Transaction failed: ' + error.message);
      socket.emit(GameEvent.ERROR, { message: error.message });
      throw new ForbiddenException(error.message);
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
    path: extendedCase[];
    salary: number;
    newPlayer: Doc<Player>;
  }> {
    const path: extendedCase[] = [];
    const addToPath = (index: number, tmpCase: Case) => {
      path.push({
        coordinates: tmpCase.coordinates,
        next: tmpCase.next,
        last: tmpCase.last,
        nextStationCaseIndex: tmpCase.nextStationCaseIndex,
        linkedHouseIndex: tmpCase.linkedHouseIndex,
        stationName: tmpCase.stationName,
        type: tmpCase.type,
        index: index,
      });
    };
    addToPath(player.casePosition, map.cases[player.casePosition]);
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
        if (path[path.length - 1].next.length > 1) {
          const direction = Math.round(Math.random());
          if (direction === 0) {
            const nextIndex = path[path.length - 1].next[0];
            addToPath(nextIndex, map.cases[nextIndex]);
          } else if (direction === 1) {
            const nextIndex = path[path.length - 1].next[1];
            addToPath(nextIndex, map.cases[nextIndex]);
          }
        } else {
          const nextIndex = path[path.length - 1].next[0];
          addToPath(nextIndex, map.cases[nextIndex]);
        }
      } else {
        const nextIndex = path[path.length - 1].next[0];
        addToPath(nextIndex, map.cases[nextIndex]);
      }
    }
    // player.casePosition = map.cases.indexOf(path[path.length - 1]);
    let newCasePos = path[path.length - 1].index;
    if (newCasePos === -1) {
      console.warn('corrupted case position');
      newCasePos = 0;
    }
    const newPlayer = await this.playerService.findByIdAndUpdate(
      player.id,
      {
        turnPlayed: true,
        casePosition: newCasePos,
      },
      this.serverGateway.getServer(),
    );
    await this.playerMoneyTransaction(
      totalEarnThisTurn,
      Bank.id,
      player.id,
      moneyTransactionType.SALARY,
      {
        createTransactionDocument: true,
        forceTransaction: true,
      },
    );
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
    if (!player) {
      throw new NotFoundException('Player not found');
    }
    if (player.casePosition === -1) {
      throw new NotFoundException('Player position corrupted');
    }
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
              {
                createTransactionDocument: true,
                forceTransaction: true,
              },
            );
            await this.playerService.findByIdAndUpdate(
              player.id,
              {
                $pull: { bonuses: playerVaultType.loan },
                turnPlayed: true,
                actionPlayed: true,
              },
              this.serverGateway.getServer(),
            );
            return GameEvent.BANK_LOAN_REFUND;
          }
          return GameEvent.BANK_LOAN_REQUEST;
        case CaseType.HOUSE:
          if (autoPlay) {
            // If it's a forced choice, player pay the house rent.
            const lobby = await this.lobbyService.findOne(player.lobby);
            if (!lobby) {
              throw new NotFoundException('Lobby not found');
            }
            const house = await this.houseService.findWithCase(
              player.casePosition,
              player.lobby,
              lobby.map,
            );
            if (!house) {
              throw new NotFoundException(
                'House not found at position ' + player.casePosition,
              );
            }
            if (house.owner !== player.id && house.owner !== '') {
              const cost = house.rent[house.level];
              // Pay rent
              await this.playerMoneyTransaction(
                cost,
                player.id,
                house.owner,
                moneyTransactionType.RENT,
                {
                  createTransactionDocument: true,
                  forceTransaction: true,
                },
              );
            }
            await this.playerService.findByIdAndUpdate(
              player.id,
              {
                turnPlayed: true,
                actionPlayed: true,
              },
              this.serverGateway.getServer(),
            );
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
        case CaseType.INTERSECTION:
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              turnPlayed: true,
              actionPlayed: true,
            },
            this.serverGateway.getServer(),
          );
          return GameEvent.UNHANDLED_EVENT;
        case CaseType.START:
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              turnPlayed: true,
              actionPlayed: true,
            },
            this.serverGateway.getServer(),
          );
          return GameEvent.UNHANDLED_EVENT;
        default:
          throw new NotImplementedException('Case type not implemented');
      }
    } catch (error) {
      throw new NotImplementedException('mandatoryAction : ' + error.message);
    }
  }

  async startGame(lobby: Doc<Lobby>) {
    if (lobby.started) {
      throw new ForbiddenException('Game already started');
    }
    const newLobby = await this.lobbyService.findByIdAndUpdate(
      lobby.id,
      {
        started: true,
        startTime: new Date(),
      },
      this.serverGateway.getServer(),
    );
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
    data: {
      createTransactionDocument: boolean;
      forceTransaction: boolean;
    } = {
      createTransactionDocument: false,
      forceTransaction: false,
    },
  ) {
    if (fromPlayer === '' || toPlayer === '') {
      throw new BadRequestException('Player ID cannot be empty');
    }
    try {
      let fromPlayerTmp: Doc<Player> | { id: string } = { id: '' };
      let toPlayerTmp: Doc<Player> | { id: string } = { id: '' };

      //#region Assign players and check if they have enough money
      if (typeof toPlayer === typeof '' && toPlayer !== Bank.id) {
        toPlayerTmp = await this.playerService.findOneById(toPlayer.toString());
      } else {
        toPlayerTmp.id = Bank.id;
      }
      if (typeof fromPlayer === typeof '' && fromPlayer !== Bank.id) {
        fromPlayerTmp = await this.playerService.findOneById(
          fromPlayer.toString(),
        );
        if (!data.forceTransaction && fromPlayerTmp.money < amount) {
          const targetSocketId = await this.getSocketId(fromPlayerTmp.id);
          throw new ForbiddenException(ANSWER().NOT_ENOUGH_MONEY);
        }
      } else {
        fromPlayerTmp.id = Bank.id;
      }
      //#endregion

      //#region Update players money and add achievements pay me
      if (typeof fromPlayer === typeof '' && fromPlayer !== Bank.id) {
        await this.playerService.findByIdAndUpdate(
          fromPlayerTmp.id,
          {
            $inc: { money: -amount },
          },
          this.serverGateway.getServer(),
        );
      }
      if (typeof toPlayer === typeof '' && toPlayer !== Bank.id) {
        await this.playerService.findByIdAndUpdate(
          toPlayerTmp.id,
          {
            $inc: { money: amount },
          },
          this.serverGateway.getServer(),
        );
        // if (toPlayerTmp === typeof Doc<Player>) {
        // }
        // await this.userService.statisticsUpdate(
        //   toPlayerTmp.user,
        //   AchievementType.payMe,
        // );
      }
      //#endregion

      if (data.createTransactionDocument) {
        await this.playerService.generateTransaction(
          fromPlayerTmp.id,
          toPlayerTmp.id,
          amount, // from player deduction
          type,
          this.serverGateway.getServer(),
        );
      }
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
    return await this.playerService.findByIdAndUpdate(
      player.id,
      {
        rating: newRating,
      },
      this.serverGateway.getServer(),
    );
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
    try {
      const player = await this.playerService.findOneById(playerId);
      switch (caseEventType) {
        case CaseEventType.DICE_DOUBLE:
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              $push: { bonuses: playerVaultType.dicePlus2 },
            },
            this.serverGateway.getServer(),
          );
          break;
        case CaseEventType.ELECTRICITY_FAILURE:
          await this.houseService.setHouseFailure(
            player.id,
            'electricity',
            this.serverGateway.getServer(),
          );
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              turnPlayed: true,
              actionPlayed: true,
            },
            this.serverGateway.getServer(),
          );
          break;
        case CaseEventType.FIRE_FAILURE:
          await this.houseService.setHouseFailure(
            player.id,
            'fire',
            this.serverGateway.getServer(),
          );
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              turnPlayed: true,
              actionPlayed: true,
            },
            this.serverGateway.getServer(),
          );
          break;
        case CaseEventType.WATER_FAILURE:
          await this.houseService.setHouseFailure(
            player.id,
            'water',
            this.serverGateway.getServer(),
          );
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              turnPlayed: true,
              actionPlayed: true,
            },
            this.serverGateway.getServer(),
          );
          break;
        case CaseEventType.RENT_DISCOUNT:
          await this.playerService.findByIdAndUpdate(
            player.id,
            {
              $push: { bonuses: playerVaultType.rentDiscount },
              turnPlayed: true,
              actionPlayed: true,
            },
            this.serverGateway.getServer(),
          );
          break;
        case CaseEventType.CASINO:
          if (!autoPlay) {
            await this.playerService.findByIdAndUpdate(
              player.id,
              {
                $push: { bonuses: playerVaultType.casino_temp },
              },
              this.serverGateway.getServer(),
            );
          }
          break;
      }
      return caseEventType;
    } catch (error) {
      throw new NotImplementedException('mapEvent : ' + error.message);
    }
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
          socket.emit(ANSWER().NOT_ENOUGH_MONEY);
          throw new ForbiddenException(ANSWER().NOT_ENOUGH_MONEY);
        }
        await this.playerMoneyTransaction(
          map.configuration.busPrice,
          player.id,
          Bank.id,
          moneyTransactionType.BUS,
          {
            createTransactionDocument: true,
            forceTransaction: false,
          },
        );
        await this.teleportPlayer(player.id, socket);
        const InfoBus: InfoSocket = {
          icon: ticketOutline,
          message: 'Vous avez pris le bus.',
          title: 'Ticket payé',
        };
        socket.emit(GameEvent.INFO, InfoBus);
        break;
      case PlayerEvent.METRO_PAY:
        if (player.money < map.configuration.metroPrice) {
          throw new ForbiddenException(ANSWER().NOT_ENOUGH_MONEY);
        }
        await this.playerMoneyTransaction(
          map.configuration.metroPrice,
          player.id,
          Bank.id,
          moneyTransactionType.METRO,
          {
            createTransactionDocument: true,
            forceTransaction: false,
          },
        );
        await this.teleportPlayer(player.id, socket);
        const InfoMetro: InfoSocket = {
          icon: ticketOutline,
          message: 'Vous avez pris le métro.',
          title: 'Ticket payé',
        };
        socket.emit(GameEvent.INFO, InfoMetro);
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
      case PlayerEvent.REPAIR_HOUSE:
        await this.repairHouse(player, attachedId as number, map, socket);
        break;
      case PlayerEvent.UPGRADE_HOUSE:
        await this.upgradeHouse(player, attachedId as number, map, socket);
        break;
      case PlayerEvent.SELL_HOUSE:
        await this.sellHouse(player, attachedId as number, map, socket);
        break;
    }
  }

  /**
   * Buy a house in auction.
   * @param lobby
   * @param player
   * @param houseIndex
   * @param map
   * @param socket
   */
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
      ) &&
      house.state !== houseState.SALE
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
    if (house.state !== houseState.SALE && house.state !== houseState.FREE) {
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
      await this.playerMoneyTransaction(
        house.auction,
        Bank.id,
        house.nextOwner,
        moneyTransactionType.AUCTION,
        {
          createTransactionDocument: false,
          forceTransaction: true,
        },
      );
    }
    await this.playerMoneyTransaction(
      newAuction,
      player.id,
      Bank.id,
      moneyTransactionType.AUCTION,
      {
        createTransactionDocument: false,
        forceTransaction: true,
      },
    );

    const targetSocketId = await this.getSocketId(house.nextOwner);

    promises = [];
    promises.push(
      this.houseService.findByIdAndUpdate(
        house.id,
        {
          nextOwner: player.id,
          auction: newAuction,
        },
        this.serverGateway.getServer(),
      ),
    );
    const auctionSetInfo: InfoSocket = {
      icon: checkmark,
      message: ANSWER(newAuction).AUCTION_SET,
      title: 'Enchère remportée',
    };
    const auctionUnsetInfo: InfoSocket = {
      icon: close,
      message: ANSWER(map.houses[house.index].name, player.nickname)
        .AUCTION_SURPASSED,
      title: 'Enchère dépassée',
    };
    promises.push(
      socket.to(targetSocketId).emit(GameEvent.INFO, auctionUnsetInfo),
    );
    promises.push(socket.emit(GameEvent.INFO, auctionSetInfo));
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
      {
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    const { chance, value } = map.configuration.casino;
    const targetSocketId = await this.getSocketId(player.id);
    if (random < chance) {
      const money = (1 / chance) * value;
      const winInfo: InfoSocket = {
        icon: trophy,
        message: 'Vous avez gagné ' + money + '.',
        title: 'Casino',
      };
      await socket.to(targetSocketId).emit(GameEvent.INFO, winInfo);
      await this.playerMoneyTransaction(
        money,
        Bank.id,
        player.id,
        moneyTransactionType.CASINO,
        {
          createTransactionDocument: true,
          forceTransaction: false,
        },
      );
    } else {
      const lostInfo: InfoSocket = {
        icon: close,
        message: ANSWER(value).CASINO_LOOSE,
        title: 'Casino',
      };
      await socket.to(targetSocketId).emit(GameEvent.INFO, lostInfo);
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
    if (!monument) {
      throw new NotFoundException(ANSWER().NOT_ON_THE_CASE);
    }
    if (player.money < monument.price) {
      throw new ForbiddenException(ANSWER().NOT_ENOUGH_MONEY);
    }
    await this.playerMoneyTransaction(
      monument.price,
      player.id,
      Bank.id,
      moneyTransactionType.MONUMENTS_PAY,
      {
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    await this.playerRatingTransaction(monument.bonus, player.id, socket);
    await this.playerService.generateTransaction(
      Bank.id,
      player.id,
      monument.bonus,
      ratingTransactionType.MONUMENTS_RATING,
      this.serverGateway.getServer(),
    );
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.monumentsRestorer,
    );
    const MetroInfo: InfoSocket = {
      icon: build,
      message: 'Vous avez gagné ' + monument.bonus + ' points de réputation.',
      title: 'Monument restauré',
    };
    socket.emit(GameEvent.INFO, MetroInfo);
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
          house.owner,
          0,
          moneyTransactionType.RENT_FRAUD,
          this.serverGateway.getServer(),
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
          {
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
      {
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
    const targetPlayer = await this.playerService.findOneById(targetPlayerId);
    const fromPlayer = await this.playerService.findOneById(sourcePlayerId);
    const InfoCopsTarget: InfoSocket = {
      icon: handLeft,
      message: 'Vous avez été dénoncé aux flics par ' + fromPlayer.nickname,
      title: 'Plainte déposée',
    };
    await socket.to(targetSocketId).emit(GameEvent.INFO, InfoCopsTarget);
    const InfoCopsFrom: InfoSocket = {
      icon: paperPlane,
      message: 'Vous avez dénoncé ' + targetPlayer.nickname + ' aux flics.',
      title: 'Plainte déposée',
    };
    await socket.emit(GameEvent.INFO, InfoCopsFrom);
    await this.playerService.generateTransaction(
      targetPlayerId,
      sourcePlayerId,
      cops,
      ratingTransactionType.COPS_RATING,
      this.serverGateway.getServer(),
      false,
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
      throw new ForbiddenException(ANSWER().NOT_ENOUGH_MONEY);
    }
    await this.playerMoneyTransaction(
      map.configuration.school.cost,
      player.id,
      Bank.id,
      moneyTransactionType.SCHOOL,
      {
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    await this.playerService.findByIdAndUpdate(
      player.id,
      {
        $push: { bonuses: playerVaultType.diploma },
      },
      this.serverGateway.getServer(),
    );
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.student,
    );
  }

  /**
   * Teleport a player to the next station.
   * @param playerId
   * @param socket
   */
  async teleportPlayer(playerId: string, socket: ServerGuardSocket) {
    const player = await this.playerService.findOneById(
      playerId,
      '+transactions',
    );
    const lobby = await this.lobbyService.findOne(player.lobby);
    const map = await this.mapService.findOne(lobby.map);
    const targetCaseIndex = map.cases[player.casePosition].nextStationCaseIndex;
    await this.playerService.findByIdAndUpdate(
      player.id,
      {
        casePosition: targetCaseIndex,
      },
      this.serverGateway.getServer(),
    );
    const targetSocketId = await this.getSocketId(player.id);
    await this.userService.statisticsUpdate(
      player.user,
      AchievementType.teleport,
    );
  }

  /**
   * Repair a house.
   * @param player
   * @param houseIndex
   * @param map
   * @param socket
   */
  async repairHouse(
    player: Doc<Player>,
    houseIndex: number,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const house = await this.houseService.findOne(player.lobby, houseIndex);
    if (player.money < map.configuration.repairCost) {
      throw new ForbiddenException(ANSWER().NOT_ENOUGH_MONEY);
    }
    await this.playerMoneyTransaction(
      map.configuration.repairCost /
        this.playerService.ratingMultiplicator(player, map),
      player.id,
      Bank.id,
      moneyTransactionType.REPAIR,
      {
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    await this.houseService.findByIdAndUpdate(
      house.id,
      {
        activeDefect: {
          electricity: false,
          fire: false,
          water: false,
        },
      },
      this.serverGateway.getServer(),
    );
    const repairInfo: InfoSocket = {
      icon: hammer,
      message: ANSWER(map.configuration.repairCost).HOUSE_REPAIR,
      title: 'Réparation efféctuée',
    };
    await socket.emit(GameEvent.INFO, repairInfo);
  }

  /**
   * Upgrade a house.
   * @param player
   * @param houseIndex
   * @param map
   * @param socket
   */
  async upgradeHouse(
    player: Doc<Player>,
    houseIndex: number,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const house = await this.houseService.findOne(player.lobby, houseIndex);
    const cost =
      this.playerService.ratingMultiplicator(player, map) *
      house.price[house.level + 1];
    if (house.level === 3) {
      throw new ForbiddenException('La maison est déjà au niveau maximum.');
    }
    if (house.nextLevel && house.level !== house.nextLevel) {
      throw new ForbiddenException(
        'La maisons a déjà été améliorée pendant ce tour.',
      );
    }
    if (player.money < cost) {
      throw new ForbiddenException("Pas assez d'argent");
    }
    await this.playerMoneyTransaction(
      cost,
      player.id,
      Bank.id,
      moneyTransactionType.UPGRADE_HOUSE,
      {
        createTransactionDocument: true,
        forceTransaction: false,
      },
    );
    const newLevel = house.level + 1 > 3 ? 3 : house.level + 1;
    await this.houseService.findByIdAndUpdate(
      house.id,
      {
        nextLevel: newLevel,
      },
      this.serverGateway.getServer(),
    );
  }

  /**
   * Sell a house.
   * @param player
   * @param houseIndex
   * @param map
   * @param socket
   */
  async sellHouse(
    player: Doc<Player>,
    houseIndex: number,
    map: Doc<Map>,
    socket: ServerGuardSocket,
  ) {
    const house = await this.houseService.findOne(player.lobby, houseIndex);
    if (house.state !== houseState.OWNED) {
      throw new ForbiddenException('Vous ne pouvez pas vendre cette maison.');
    }
    await this.houseService.findByIdAndUpdate(
      house.id,
      {
        state: houseState.SALE,
      },
      this.serverGateway.getServer(),
    );
    const sellInfo: InfoSocket = {
      icon: wallet,
      message: ANSWER().HOUSE_SELLING,
      title: 'Maison en vente',
    };
    socket.emit(GameEvent.INFO, sellInfo);
  }
}
