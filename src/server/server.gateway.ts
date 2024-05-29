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
import { transactionType } from 'src/player/player.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';

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
  @SubscribeMessage('subscribe')
  async suscribe(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    console.log('subscribe', data.lobbyId, socket.handshake.user.sub);
    this.serverService.setSocketId(socket.handshake.user.sub, socket.id);
    socket.join(data.lobbyId);
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage('getParty')
  async getParty(
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
          const players = await this.playerService.findAllFromLobby(lobby.id);
          const houses = await this.houseService.findAllFromLobby(lobby.id);
          socket.emit(GameEvent.GET_PARTY, { lobby, houses, players, map });
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage('playTurn')
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
            await this.serverService.generatePath(dice, map, player);
          console.log(path, salary, newPlayer);
          await this.serverService.mandatoryAction(
            map,
            newPlayer.id,
            false,
            socket,
          );
          socket.emit(GameEvent.PLAY_TURN, { path, salary });
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage('makeAuction')
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
                transactionType.AUCTION,
                socket,
              ),
            );
          }
          promises.push(
            this.serverService.playerMoneyTransaction(
              newAuction,
              player.id,
              Bank.id,
              transactionType.AUCTION,
              socket,
            ),
          );
          await Promise.all(promises);

          const targetSocketId = await this.serverService.getSocketId(
            house.nextOwner,
          );

          promises = [];
          promises.push(
            this.houseService.findByIdAndUpdate(house.id, {
              nextOwner: player.id,
              auction: newAuction,
            }),
          );
          promises.push(
            socket
              .to(targetSocketId)
              .emit(
                GameEvent.LOST_AUCTION,
                new AuctionData(data.houseIndex, player.id, newAuction),
              ),
          );
          promises.push(
            socket
              .to(lobby.id)
              .emit(
                GameEvent.AUCTION,
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
}
