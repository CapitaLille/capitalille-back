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
import { from } from 'rxjs';

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
    const playerTmp = await this.playerModel.create(player);
    return playerTmp;
  }

  async findAll() {
    return await this.playerModel.find();
  }

  async findOneByUserId(
    userId: string,
    lobbyId: string,
    key: string = undefined,
  ) {
    if (key) {
      return await this.playerModel
        .findOne({ user: userId, lobby: lobbyId })
        .select(key);
    } else {
      return await this.playerModel.findOne({ user: userId, lobby: lobbyId });
    }
  }

  async findOneById(
    playerId: string,
    key: string = undefined,
  ): Promise<Doc<Player>> {
    if (key) {
      return await this.playerModel.findById(playerId).select(key);
    } else {
      return await this.playerModel.findById(playerId);
    }
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
      const newPlayer = await this.playerModel
        .findByIdAndUpdate(playerId, update, { new: true })
        .select('+transactions');
      if (!newPlayer) {
        throw new NotFoundException('Player not found.');
      }
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
  async generateDice(
    player: Doc<Player>,
    Server: Server,
  ): Promise<{
    diceValue: number;
    dices: number[];
    diceBonuses: playerVaultType[];
  }> {
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const dice3 = Math.floor(Math.random() * 6) + 1;
    let dice = dice1 + dice2 + dice3;

    const diceBonuses = player.bonuses.filter(
      (bonus) =>
        bonus === playerVaultType.diceDouble ||
        bonus === playerVaultType.diceDividedBy2 ||
        bonus === playerVaultType.diceMinus2 ||
        bonus === playerVaultType.dicePlus2,
    );
    const otherBonuses = player.bonuses.filter(
      (bonus) =>
        bonus !== playerVaultType.diceDouble &&
        bonus !== playerVaultType.diceDividedBy2 &&
        bonus !== playerVaultType.diceMinus2 &&
        bonus !== playerVaultType.dicePlus2,
    );
    for (const bonus of diceBonuses) {
      player.bonuses.splice(player.bonuses.indexOf(bonus), 1);
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
    const newPlayer = await this.playerModel.findByIdAndUpdate(
      player.id,
      {
        bonuses: otherBonuses,
      },
      Server,
    );
    return {
      dices: [dice1, dice2, dice3],
      diceValue: dice,
      diceBonuses: diceBonuses,
    };
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
    targetPlayerId: string,
    amount: number,
    type: moneyTransactionType | ratingTransactionType,
    Server: Server,
  ) {
    try {
      if (fromPlayerId === '' || targetPlayerId === '') {
        throw new BadRequestException('No player ID provided.');
      }
      if (amount < 0) {
        console.warn('Cannot transfer negative amount of money.');
        return;
      }
      if (fromPlayerId === targetPlayerId) {
        console.warn('Cannot transfer money to yourself.');
        return;
      }
      if (fromPlayerId !== Bank.id) {
        const fromTransaction = this.createTransaction(
          fromPlayerId,
          targetPlayerId,
          amount,
          type,
          Server,
        );
      }
      if (targetPlayerId !== Bank.id) {
        const toTransaction = this.createTransaction(
          targetPlayerId,
          fromPlayerId,
          -amount,
          type,
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

  /**
   * Generate a transaction from player.
   * @param player
   * @param amount
   * @param type
   * @returns
   */
  private async createTransaction(
    fromPlayerId: string,
    toPlayerId: string,
    amount: number,
    type: moneyTransactionType | ratingTransactionType,
    Server: Server,
  ) {
    const player = await this.playerModel.findById(
      fromPlayerId,
      '+transactions',
    );
    const transactions = player.transactions;
    if (
      transactions[transactions.length - 1].type ===
        moneyTransactionType.SALARY &&
      type === moneyTransactionType.SALARY
    ) {
      transactions[transactions.length - 1].amount += amount;
      transactions[transactions.length - 1].stack += 1;
      this.findByIdAndUpdate(player.id, { transactions }, Server);
    } else {
      this.findByIdAndUpdate(
        player.id,
        {
          $push: {
            transactions: {
              amount,
              playerId: toPlayerId,
              type,
              stack: 1,
              date: new Date(),
            },
          },
        },
        Server,
      );
    }
  }
}
