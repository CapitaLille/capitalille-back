import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UseFilters,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import {
  Player,
  moneyTransactionType,
  playerVaultType,
  ratingTransactionType,
} from './player.schema';
import { lobbyConstants } from 'src/user/constants';
import { Bank, Doc, GameEvent, MoneyChangeData } from 'src/server/server.type';
import { ServerService } from 'src/server/server.service';
import { ServerGateway, ServerGuardSocket } from 'src/server/server.gateway';
import { Map } from 'src/map/map.schema';
import { UserService } from 'src/user/user.service';
import { Server } from 'socket.io';
import { User } from 'src/user/user.schema';

@Injectable()
export class PlayerService {
  constructor(
    @InjectModel('Player') private readonly playerModel: Model<Player>,
  ) {}

  async create(user: Doc<User>, lobbyId: string): Promise<Doc<Player>> {
    const player = {
      user: user.id,
      nickname: user.nickname,
      pp: user.pp,
      lobby: lobbyId,
    };
    return await this.playerModel.create(player);
  }

  async findAll() {
    return await this.playerModel.find();
  }

  async findOne(userId: string, lobbyId: string) {
    return await this.playerModel.findOne({ user: userId, lobby: lobbyId });
  }

  async findOneById(playerId: string): Promise<Doc<Player>> {
    return await this.playerModel.findById(playerId);
  }

  async findAllFromLobby(lobbyId: string) {
    const players = await this.playerModel.find({ lobby: lobbyId });
    if (!players) {
      return undefined;
    }
    return players;
  }

  async findByIdAndUpdate(
    playerId: string,
    update: UpdateQuery<Player>,
    server: Server,
  ) {
    try {
      const newPlayer = await this.playerModel.findByIdAndUpdate(
        playerId,
        update,
        { new: true },
      );
      if (!newPlayer) {
        throw new NotFoundException('Player not found.');
      }
      console.log('Player updated : ', newPlayer.id);
      await server
        .in(newPlayer.lobby)
        .emit(GameEvent.PLAYER_UPDATE, { player: newPlayer });
      return newPlayer;
    } catch (error) {
      throw new NotImplementedException(
        'findByIdAndUpdatePlayer : ' + error.message,
      );
    }
  }

  deleteOneFromLobby(userId: string, lobbyId: string): Promise<any> {
    return this.playerModel.deleteOne({ user: userId, lobby: lobbyId });
  }

  deleteAllFromLobby(lobbyId: string): Promise<any> {
    return this.playerModel.deleteMany({ lobby: lobbyId });
  }

  /**
   * Calculate multiplicator base on the player rating and the map configuration.
   */
  ratingMultiplicator(player: Doc<Player>, map: Doc<Map>): number {
    const rating = player.rating; // Rating 0-5 (2.5 Normal)
    const multiplicator = map.configuration.ratingMultiplicator; // [0.8, 1.2]
    const multiplicatorRange = multiplicator[1] - multiplicator[0]; // 0.4
    const ratingMultiplicator =
      (rating / 5) * multiplicatorRange + multiplicator[0];
    return ratingMultiplicator;
  }

  /**
   * Calculate the player salary based on the player bonuses and the map configuration.
   * @param player
   * @param map
   * @returns
   */
  getPlayerSalary(player: Doc<Player>, map: Doc<Map>): number {
    const diplomeCount = player.bonuses.filter(
      (bonus) => bonus === playerVaultType.diploma,
    ).length;
    return (
      map.configuration.salary + map.configuration.school.bonus * diplomeCount
    );
  }

  /**
   * Generate a dice roll for a player based on their bonuses.
   * @param player
   * @returns The dice roll.
   */
  generateDice(
    player: Doc<Player>,
    Server: Server,
  ): {
    diceValue: number;
    diceBonuses: playerVaultType[];
  } {
    let dice =
      Math.floor(Math.random() * 6) +
      1 +
      Math.floor(Math.random() * 6) +
      1 +
      Math.floor(Math.random() * 6) +
      1;

    const diceBonuses = player.bonuses.filter(
      (bonus) =>
        bonus === playerVaultType.diceDouble ||
        bonus === playerVaultType.diceDividedBy2 ||
        bonus === playerVaultType.diceMinus2 ||
        bonus === playerVaultType.dicePlus2,
    );
    for (const bonus of diceBonuses) {
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
    this.playerModel.findByIdAndUpdate(
      player.id,
      {
        $pull: { bonuses: { $in: [diceBonuses] } },
      },
      Server,
    );
    return { diceValue: dice, diceBonuses: diceBonuses };
  }

  /**
   * Generate a transaction DOCUMENT between two players.
   * @param fromPlayerId
   * @param amount of money to transfer.
   * @param targetPlayerId
   * @param type
   * @returns
   */
  async generateTransaction(
    fromPlayerId: string,
    amount: number,
    targetPlayerId: string,
    type: moneyTransactionType | ratingTransactionType,
    Server: Server,
  ) {
    try {
      if (amount <= 0) {
        throw new ForbiddenException(
          'Transaction amount must be positive and non-zero.',
        );
      }
      console.log(
        'generateTransactionRent',
        fromPlayerId,
        amount,
        targetPlayerId,
        type,
      );
      // If the sender is the bank, we don't need to update the sender player.
      if (fromPlayerId !== Bank.id) {
        const player = await this.findOneById(fromPlayerId);
        if (!player) {
          return undefined;
        }
        await this.findByIdAndUpdate(
          player.id,
          {
            $push: {
              transactions: {
                amount: -amount,
                playerId: targetPlayerId,
                type,
                date: new Date(),
              },
            },
          },
          Server,
        );
      }
      // If the target is the bank, we don't need to update the target player.
      if (targetPlayerId !== Bank.id) {
        const targetPlayer = await this.findOneById(targetPlayerId);
        if (!targetPlayer) {
          return undefined;
        }
        await this.findByIdAndUpdate(
          targetPlayer.id,
          {
            $push: {
              transactions: {
                amount: amount,
                playerId: fromPlayerId,
                type,
                date: new Date(),
              },
            },
          },
          Server,
        );
      }
    } catch (error) {
      console.error('playerGenerateTransaction : ' + error.message);
      throw new NotImplementedException(
        'playerGenerateTransaction : ' + error.message,
      );
    }
  }
}
