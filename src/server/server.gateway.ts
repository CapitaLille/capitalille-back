import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
  WsResponse,
} from '@nestjs/websockets';
import { ServerGuard } from './server.guard';
import { Socket } from 'socket.io';
import { LobbyService } from 'src/lobby/lobby.service';
import { Observable } from 'rxjs';
import { GameError, GameEvent, GameResponse } from './server.type';
import e from 'express';
import { HouseService } from 'src/house/house.service';
import { PlayerService } from 'src/player/player.service';
import { MapService } from 'src/map/map.service';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { ServerService } from './server.service';

// Étendre le type Handshake de socket.io avec une propriété user
type HandshakeWithUser = Socket['handshake'] & {
  user: authPayload;
};

// Étendre le type Socket de socket.io avec le nouveau type HandshakeWithUser
export type ServerGuardSocket = Socket & {
  handshake: HandshakeWithUser;
};

@WebSocketGateway({ cors: true })
export class ServerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly lobbyService: LobbyService,
    private readonly houseService: HouseService,
    private readonly playerService: PlayerService,
    private readonly serverService: ServerService,
    private readonly mapService: MapService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  handleConnection(client: any, ...args: any[]) {
    console.log('client connected', client.id);
  }

  handleDisconnect(client: any) {
    console.log('client disconnected', client.id);
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage('suscribe')
  async suscribe(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    this.serverService.setSocketId(socket.handshake.user.sub, socket.id);
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage('getParty')
  async getParty(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    const userId = socket.handshake.user.sub;
    try {
      this.serverService.gameSession(
        data.lobbyId,
        userId,
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
  ): Promise<WsResponse<any>> {
    const userId = socket.handshake.user.sub;
    try {
      this.serverService.gameSession(
        data.lobbyId,
        userId,
        async (lobby, player, map) => {
          if (player.turnPlayed) {
            throw new Error('Player already played his turn');
          }
          const dice = this.serverService.generateDice(player);
          const { path, salary, newPlayer } =
            await this.serverService.generatePath(dice, map, player);
          await this.serverService.mandatoryAction(map, newPlayer, socket);
          socket.emit(GameEvent.PLAY_TURN, { path, salary });
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage('try')
  startQuiz(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { partyId: string },
  ): string {
    // console.log('socket', socket.handshake.user);
    const event = 'events';
    const response = [1, 2, 3];
    return 'Hello world!';
  }
}
