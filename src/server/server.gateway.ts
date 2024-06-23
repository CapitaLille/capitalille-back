import { ForbiddenException, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ServerGuard } from './server.guard';
import { Socket } from 'socket.io';
import { Server } from 'socket.io';
import { GameEvent } from './server.type';
import { HouseService } from 'src/house/house.service';
import { PlayerService } from 'src/player/player.service';
import { MapService } from 'src/map/map.service';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { ServerService } from './server.service';
import { PlayerEvent, playerVaultType } from 'src/player/player.schema';
import { SchedulerService } from './scheduler.service';
import { CaseType } from 'src/map/map.schema';
import { UserService } from 'src/user/user.service';
import { AchievementType } from 'src/user/user.schema';
import { LobbyService } from 'src/lobby/lobby.service';

// Étendre le type Handshake de socket.io avec une propriété user
type HandshakeWithUser = Socket['handshake'] & {
  user: authPayload;
};

// Étendre le type Socket de socket.io avec le nouveau type HandshakeWithUser
export type ServerGuardSocket = Socket & {
  handshake: HandshakeWithUser;
};

@WebSocketGateway({ cors: true })
@UseGuards(ServerGuard)
// @UseInterceptors(ExecutionInterceptor)
export class ServerGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly houseService: HouseService,
    private readonly playerService: PlayerService,
    private readonly serverService: ServerService,
    private readonly lobbyService: LobbyService,
    private readonly mapService: MapService,
    private readonly userService: UserService,
    private readonly schedulerService: SchedulerService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}
  @WebSocketServer() server: Server;

  async afterInit(server: Server) {
    const finishedLobbies = await this.lobbyService.findAllFinished();
    finishedLobbies.forEach((lobby) => {
      console.log('Schedule delete lobby', lobby.id);
      this.schedulerService.scheduleDeleteLobby(lobby.id);
    });

    this.schedulerService.scheduleLobbies(server);
    this.schedulerService.launchPublicLobbies();
    // console.warn('Comment this line to enable scheduler');
    console.log('Server initialized');
  }

  handleConnection(client: any, ...args: any[]) {}

  handleDisconnect(client: any) {
    this.serverService.removeSocketId(undefined, client.id);
  }

  @SubscribeMessage(PlayerEvent.SUBSCRIBE)
  async suscribe(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string; code: string },
  ) {
    console.log('Subscribe', data.lobbyId, socket.handshake.user.sub);
    let player = await this.playerService.findOneByUserId(
      socket.handshake.user.sub,
      data.lobbyId,
    );
    if (!player) {
      console.log('Join lobby');
      player = await this.lobbyService.joinLobby(
        data.lobbyId,
        socket.handshake.user.sub,
        this.getServer(),
        data.code,
      );
    }
    this.serverService.setSocketId(player.id, socket.id);
    socket.join(data.lobbyId);
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          console.log('Game session', lobby.id, socket.id);
          const players = await this.playerService.findAllFromLobby(lobby.id);
          console.log('Players', players.length);
          const houses = await this.houseService.findAllFromLobby(lobby.id);
          console.log('Houses', houses.length);
          const users = await this.userService.findByIds(lobby.users);
          console.log('Users', users.length);
          const delay = await this.schedulerService.getDelay(lobby.id);
          socket.emit(GameEvent.NEXT_TURN, { delay });
          console.log('Emit subscribe', lobby.id, socket.id);
          socket.emit(GameEvent.SUBSCRIBE, {
            lobby,
            houses,
            players,
            users,
            map,
            player,
          });
          if (
            !lobby.private &&
            !lobby.started &&
            lobby.users.length >= map.configuration.minPlayer
          ) {
            console.log('Start public game');
            await this.serverService.startGame(lobby);
            await this.schedulerService.scheduleNextTurnForLobby(
              lobby.id,
              this.getServer(),
            );
            await this.getServer()
              .in(lobby.id)
              .emit(GameEvent.START_GAME, { lobby: data.lobbyId });
          }
        },
        false,
        false,
        false,
      );
    } catch (error) {
      socket.emit(GameEvent.UNSUBSCRIBE, { message: error.message });
    }
    return;
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.START_GAME)
  async startGame(
    @ConnectedSocket() socket: ServerGuardSocket,
    @MessageBody() data: { lobbyId: string },
  ) {
    console.log('startGame', data.lobbyId, socket.handshake.user.sub);
    const userId = socket.handshake.user.sub;
    try {
      await this.serverService.gameSession(
        data.lobbyId,
        userId,
        socket,
        async (lobby, player, map) => {
          if (lobby.owner !== userId) {
            throw new ForbiddenException(
              "Il n'y a que le propriétaire qui peut lancer la partie",
            );
          }
          await this.serverService.startGame(lobby);
          await this.schedulerService.scheduleNextTurnForLobby(
            lobby.id,
            this.getServer(),
          );
          await this.getServer()
            .in(lobby.id)
            .emit(GameEvent.START_GAME, { lobby: data.lobbyId });
        },
        true,
        true,
        false,
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }

    return;
  }

  getServer(): Server {
    return this.server;
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.PLAY_TURN)
  async playTurn(
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
          if (player.turnPlayed) {
            throw new ForbiddenException('Vous avez déjà joué votre tour');
          }
          this.userService.statisticsUpdate(
            userId,
            AchievementType.diceLauncher,
          );
          const dice = await this.playerService.generateDice(
            player,
            this.getServer(),
          );
          const { path, salary, newPlayer } =
            await this.serverService.generatePath(dice.diceValue, map, player);
          const action = await this.serverService.mandatoryAction(
            map,
            newPlayer.id,
            false,
            socket,
          );
          socket.emit(GameEvent.PLAY_TURN, {
            dice,
            path,
            salary,
            action,
          });
        },
        true,
        true,
        false,
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
          await this.serverService.playerAction(
            PlayerEvent.BUY_AUCTION,
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

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.REPAIR_HOUSE)
  async repairHouse(
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
          if (house.owner !== player.id) {
            throw new ForbiddenException(
              'Player is not the owner of the house.',
            );
          }
          if (
            !house.activeDefect.fire &&
            !house.activeDefect.water &&
            !house.activeDefect.electricity
          ) {
            throw new ForbiddenException('Cette maison est en parfait état.');
          }
          await this.serverService.playerAction(
            PlayerEvent.REPAIR_HOUSE,
            data.houseIndex,
            player.id,
            socket,
          );
          await socket.emit(GameEvent.HOUSE_REPAIR);
        },
        true,
        true,
        false,
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.UPGRADE_HOUSE)
  async upgradeHouse(
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
          if (house.owner !== player.id) {
            throw new ForbiddenException(
              "Vous n'êtes pas le propriétaire de cette maison.",
            );
          }
          await this.serverService.playerAction(
            PlayerEvent.UPGRADE_HOUSE,
            data.houseIndex,
            player.id,
            socket,
          );
          await socket.emit(GameEvent.UPGRADE_HOUSE);
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.SELL_HOUSE)
  async sellingHouse(
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
          if (house.owner !== player.id) {
            throw new ForbiddenException(
              "Vous n'êtes pas le propriétaire de cette maison.",
            );
          }
          await this.serverService.playerAction(
            PlayerEvent.SELL_HOUSE,
            data.houseIndex,
            player.id,
            socket,
          );
          await socket.emit(GameEvent.SELL_HOUSE);
        },
        true,
        true,
        false,
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }

  @UseGuards(ServerGuard)
  @SubscribeMessage(PlayerEvent.MONUMENTS_PAY)
  async requestMonument(
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
          const monument = map.monuments.find((monument) => {
            monument.cases.includes(player.casePosition);
          });
          if (!monument) {
            throw new ForbiddenException(
              "Vous n'êtes pas sur une case monument.",
            );
          }
          await this.serverService.playerAction(
            PlayerEvent.MONUMENTS_PAY,
            undefined,
            player.id,
            socket,
          );
          await socket.emit(GameEvent.MONUMENTS_PAID);
        },
      );
    } catch (error) {
      socket.emit(GameEvent.ERROR, { message: error.message });
    }
  }
}
