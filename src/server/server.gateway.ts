import {
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  WsResponse,
} from '@nestjs/websockets';
import { ServerGuard } from './server.guard';
import { Socket } from 'socket.io';
import { Server } from 'socket.io';
import {
  AuctionData,
  Bank,
  GameError,
  GameEvent,
  GameResponse,
} from './server.type';
import e from 'express';
import { HouseService } from 'src/house/house.service';
import { PlayerService } from 'src/player/player.service';
import { MapService } from 'src/map/map.service';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { ServerService } from './server.service';
import {
  PlayerEvent,
  moneyTransactionType,
  playerVaultType,
} from 'src/player/player.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { CaseEventType, CaseType } from 'src/map/map.schema';

// Étendre le type Handshake de socket.io avec une propriété user
type HandshakeWithUser = Socket['handshake'] & {
  user: authPayload;
};

// Étendre le type Socket de socket.io avec le nouveau type HandshakeWithUser
export type ServerGuardSocket = Socket & {
  handshake: HandshakeWithUser;
};

@WebSocketGateway({ cors: true })
export class ServerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly houseService: HouseService,
    private readonly playerService: PlayerService,
    private readonly serverService: ServerService,
    private readonly mapService: MapService,
    private readonly schedulerService: SchedulerService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  afterInit(server: Server) {
    this.schedulerService.scheduleLobbies(server);
  }

  handleConnection(client: any, ...args: any[]) {}

  handleDisconnect(client: any) {
    this.serverService.removeSocketId(undefined, client.id);
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.SUBSCRIBE)
  async suscribe(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    console.log('subscribe', data.lobbyId, socket.handshake.user.sub);
    this.serverService.setSocketId(socket.handshake.user.sub, socket.id);
    const player = await this.playerService.findOne(
      socket.handshake.user.sub,
      data.lobbyId,
    );
    if (!player) {
      throw new NotFoundException('Player not found');
    } else {
      console.log(
        'player join the lobby :',
        data.lobbyId,
        ' playerId :',
        socket.handshake.user.sub,
      );
      socket.join(data.lobbyId);
      const userId = socket.handshake.user.sub;
      try {
        await this.serverService.gameSession(
          data.lobbyId,
          userId,
          socket,
          async (lobby, player, map) => {
            const players = await this.playerService.findAllFromLobby(lobby.id);
            const houses = await this.houseService.findAllFromLobby(lobby.id);
            socket.emit(GameEvent.SUBSCRIBE, {
              lobby,
              houses,
              players,
              map,
              player,
            });
          },
        );
      } catch (error) {
        socket.emit(GameEvent.ERROR, { message: error.message });
      }
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.PLAY_TURN)
  async playTurn(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    console.log('playTurn', data.lobbyId, socket.handshake.user.sub);
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (player.turnPlayed) {
            throw new ForbiddenException('Player already played his turn');
          }
          const dice = this.playerService.generateDice(player);
          const { path, salary, newPlayer } =
            await this.serverService.generatePath(dice.diceValue, map, player);
          await socket.emit(GameEvent.PLAYER_UPDATE, {
            player: newPlayer,
          });
          const action = await this.serverService.mandatoryAction(
            map,
            newPlayer.id,
            false,
            socket,
          );
          socket.emit(GameEvent.PLAY_TURN, {
            diceBonuses: dice.diceBonuses,
            path,
            salary,
            action,
          });
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.BUY_AUCTION)
  async makeAuction(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string; houseIndex: number },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          const house = await this.houseService.findOne(
            lobby.id,
            data.houseIndex,
          );
          const nearestCases = this.mapService.getNearestCases(
            map,
            player.casePosition,
          );
          if (
            !nearestCases.some((element) =>
              map.houses[data.houseIndex].cases.includes(element),
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
                map.houses[data.houseIndex].cases.join(','),
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
              this.serverService.playerMoneyTransaction(
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
            this.serverService.playerMoneyTransaction(
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

          const targetSocketId = await this.serverService.getSocketId(
            house.nextOwner,
          );

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
                new AuctionData(data.houseIndex, player.id, newAuction),
              ),
          );
          promises.push(
            socket
              .to(lobby.id)
              .emit(
                GameEvent.AUCTION_SET,
                new AuctionData(data.houseIndex, userId, newAuction),
              ),
          );
          await Promise.all(promises);
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.BANK_LOAN_TAKE)
  async bankLoanRequest(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          await this.serverService.playerAction(
            PlayerEvent.BANK_LOAN_TAKE,
            undefined,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.HOUSE_RENT_FRAUD)
  async houseRentFraud(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string; houseIndex: number },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          const house = await this.houseService.findOne(
            lobby.id,
            data.houseIndex,
          );
          if (map.cases[player.casePosition].type !== CaseType.HOUSE) {
            throw new ForbiddenException('Player is not on a house case');
          }
          if (house.owner === player.id) {
            throw new ForbiddenException('Player is the owner of the house');
          }
          if (
            !map.houses[data.houseIndex].cases.includes(player.casePosition)
          ) {
            throw new ForbiddenException('Player is not on the house case');
          }
          if (player.actionPlayed) {
            throw new ForbiddenException('Player already played his action');
          }
          await this.serverService.playerAction(
            PlayerEvent.HOUSE_RENT_FRAUD,
            data.houseIndex,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.HOUSE_RENT_PAY)
  async houseRentPay(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string; houseIndex: number },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          const house = await this.houseService.findOne(
            lobby.id,
            data.houseIndex,
          );
          if (map.cases[player.casePosition].type !== CaseType.HOUSE) {
            throw new ForbiddenException('Player is not on a house case');
          }
          if (house.owner === player.id) {
            throw new ForbiddenException('Player is the owner of the house');
          }
          if (
            !map.houses[data.houseIndex].cases.includes(player.casePosition)
          ) {
            throw new ForbiddenException('Player is not on the house case');
          }
          if (player.actionPlayed) {
            throw new ForbiddenException('Player already played his action');
          }
          await this.serverService.playerAction(
            PlayerEvent.HOUSE_RENT_PAY,
            data.houseIndex,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.METRO_PAY)
  async metroPay(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (map.cases[player.casePosition].type !== CaseType.METRO) {
            throw new ForbiddenException('Player is not on a metro case');
          }
          if (player.actionPlayed) {
            throw new ForbiddenException('Player already played his action');
          }
          await this.serverService.playerAction(
            PlayerEvent.METRO_PAY,
            undefined,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.BUS_PAY)
  async busPay(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          await this.serverService.playerAction(
            PlayerEvent.BUS_PAY,
            undefined,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.MONUMENTS_PAY)
  async monumentsPay(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (map.cases[player.casePosition].type !== CaseType.MONUMENTS) {
            throw new ForbiddenException('Player is not on a monuments case');
          }
          await this.serverService.playerAction(
            PlayerEvent.MONUMENTS_PAY,
            undefined,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.COPS_COMPLAINT)
  async copsComplaint(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string; targetPlayerId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (map.cases[player.casePosition].type !== CaseType.COPS) {
            throw new ForbiddenException('Player is not on a cops case');
          }
          await this.serverService.playerAction(
            PlayerEvent.COPS_COMPLAINT,
            data.targetPlayerId,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.SCHOOL_PAY)
  async schoolPay(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (map.cases[player.casePosition].type !== CaseType.SCHOOL) {
            throw new ForbiddenException('Player is not on a school case');
          }
          await this.serverService.playerAction(
            PlayerEvent.SCHOOL_PAY,
            undefined,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.CASINO_GAMBLE)
  async casinoGamble(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (map.cases[player.casePosition].type !== CaseType.EVENT) {
            throw new ForbiddenException('Player is not on a casino case');
          }
          if (!player.bonuses.includes(playerVaultType.casino_temp)) {
            throw new ForbiddenException(
              'Player does not have the casino bonus',
            );
          }
          if (player.actionPlayed) {
            throw new ForbiddenException('Player already played his action');
          }
          await this.serverService.playerAction(
            PlayerEvent.CASINO_GAMBLE,
            undefined,
            player.id,
            socket,
          );
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }
}
