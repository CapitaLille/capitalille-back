import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { cp } from 'fs';
import mongoose, { Model } from 'mongoose';
import { HouseService } from 'src/house/house.service';
import { Lobby } from 'src/lobby/lobby.schema';
import { LobbyService } from 'src/lobby/lobby.service';
import { Case, CaseType, Map } from 'src/map/map.schema';
import { MapService } from 'src/map/map.service';
import { Player, playerVaultType } from 'src/player/player.schema';
import { PlayerService } from 'src/player/player.service';
import { ServerGuardSocket } from './server.gateway';

@Injectable()
/**
 * Service class that handles server-related operations.
 */
export class ServerService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
    private readonly lobbyService: LobbyService,
    private readonly playerService: PlayerService,
    private readonly mapService: MapService,
    private readonly houseService: HouseService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async gameSession(
    lobbyId: string,
    playerId: string,
    run: (
      lobby: mongoose.Document<unknown, {}, Lobby> &
        Lobby & {
          _id: mongoose.Types.ObjectId;
        },
      player: mongoose.Document<unknown, {}, Player> &
        Player & {
          _id: mongoose.Types.ObjectId;
        },
      map: mongoose.Document<unknown, {}, Map> &
        Map & {
          _id: mongoose.Types.ObjectId;
        },
    ) => Promise<void>,
    errorMessage: string,
  ) {
    const session = await this.connection.startSession();
    try {
      session.startTransaction();
      const lobby = await this.lobbyService.findOne(lobbyId);
      if (!lobby) {
        throw new Error('Lobby not found');
      }
      const player = await this.playerService.findOne(playerId, lobbyId);
      if (!player) {
        throw new Error('Player not found');
      }
      const map = await this.mapService.findOne(lobby.map);
      if (!map) {
        throw new Error('Map not found');
      }
      await run(lobby, player, map);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw new Error('Transaction failed: ' + errorMessage);
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
    map: mongoose.Document<unknown, {}, Map> &
      Map & {
        _id: mongoose.Types.ObjectId;
      },
    player: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      },
  ): Promise<{
    path: Case[];
    salary: number;
    newPlayer: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      };
  }> {
    let path: Case[] = [map.cases[player.casePosition]];
    const playerSalary =
      this.ratingMultiplicator(player, map) * map.configuration.salary;
    for (let i = 0; i < dice; i++) {
      if (path[path.length - 1].type === CaseType.intersection) {
        player.money += playerSalary;
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
    const newPlayer = await player.save();

    return { path, salary: playerSalary, newPlayer };
  }

  /**
   * Make a mandatory action for a player based on the case they landed on.
   * @param map
   * @param player The player. WARNING: Make sure to update the player's properties (money) within this function.
   * @param socket
   */
  async mandatoryAction(
    map: mongoose.Document<unknown, {}, Map> &
      Map & {
        _id: mongoose.Types.ObjectId;
      },
    player: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      },
    socket: ServerGuardSocket,
  ) {
    const type = map.cases[player.casePosition].type;
    switch (type) {
      case CaseType.bank:
        if (player.bonuses.includes(playerVaultType.loan)) {
          // Pay the loan
        }
      case CaseType.house:
        const house = await this.houseService.findWithCase(
          player.casePosition,
          player.lobby,
        );
        if (!player.houses.includes(house.index)) {
          const cost = house.rent[house.level];
          // Pay rent
          await this.playerTransaction(
            cost,
            player,
            house.owner,
            'rent',
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

  /**
   *
   * @param amount of money to transfer
   * @param fromPlayer Source player
   * @param toId Destination player id
   * @param type Type of transaction
   * @param force Do not check if the source player has enough money
   * @param announce Emmit money change event to the players source. (Player destination will receive the event anyway)
   */
  async playerTransaction(
    amount: number,
    fromPlayer: mongoose.Document<unknown, {}, Player> &
      Player & {
        _id: mongoose.Types.ObjectId;
      },
    toId: string,
    type: string,
    socket: ServerGuardSocket,
    force: boolean = false,
    announce: boolean = false,
  ) {
    const toPlayer = await this.playerModel.findOne({ user: toId });
    if (!fromPlayer || !toPlayer) {
      throw new Error('Player not found');
    }
    if (!force && fromPlayer.money < amount) {
      throw new Error('Not enough money');
    }
    fromPlayer.money -= amount;
    toPlayer.money += amount;
    await fromPlayer.save();
    await toPlayer.save();
    if (announce) {
      socket.emit('moneyChange', {
        from: fromPlayer,
        to: toPlayer,
        amount,
        type,
      });
      // Emit event
    }
  }
}
