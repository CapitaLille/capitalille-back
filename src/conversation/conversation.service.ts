import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
  forwardRef,
} from '@nestjs/common';
import { Conversation, Message } from './conversation.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Lobby } from 'src/lobby/lobby.schema';
import { ServerGuardSocket } from 'src/server/server.gateway';
import { PlayerService } from 'src/player/player.service';
import { Doc, GameEvent } from 'src/server/server.type';
import { Player, moneyTransactionType } from 'src/player/player.schema';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import { ServerService } from 'src/server/server.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel('Conversation')
    private readonly conversationModel: Model<Conversation>,
    @Inject(forwardRef(() => ServerService))
    private serverService: ServerService,
    @Inject(forwardRef(() => PlayerService))
    private playerService: PlayerService,
  ) {}

  async findByPlayersId(ids: string[]) {
    // players contains all the players in the conversation
    return await this.conversationModel.findOne({ players: { $all: ids } });
  }

  async sendMessage(
    lobby: Doc<Lobby>,
    sourcePlayer: Doc<Player>,
    sourcePlayerSocketId: string,
    targetPlayer: Doc<Player>,
    targetPlayerSocketId: string,
    message: Message,
    socket: Server,
  ) {
    if (targetPlayer.lobby !== lobby.id) {
      return;
    }
    let conversation = await this.findByPlayersId([
      sourcePlayer.id,
      targetPlayer.id,
    ]);
    if (!conversation) {
      conversation = await this.conversationModel.create({
        players: [sourcePlayer.id, targetPlayer.id],
        lobbyId: lobby.id,
      });
    }
    if (message.proposal) {
      if (
        message.proposal.sourceHouses.some(
          (house) => !sourcePlayer.houses.includes(house),
        )
      ) {
        throw new ForbiddenException(
          'Vous ne pouvez inclure des maisons que vous ne possédez pas dans votre proposition.',
        );
      }
      if (
        message.proposal.targetHouses.some(
          (house) => !targetPlayer.houses.includes(house),
        )
      ) {
        throw new ForbiddenException(
          "Vous ne pouvez inclure des maisons que l'autre joueur ne possède pas dans votre proposition.",
        );
      }
      if (message.proposal.sourceMoney > sourcePlayer.money) {
        throw new ForbiddenException(
          "Vous ne pouvez proposer plus d'argent que ce que vous avez.",
        );
      }
    }
    if (!message.content && !message.proposal) {
      throw new ForbiddenException(
        'Vous devez envoyer un message ou une offre.',
      );
    }

    const id = await nanoid(20);
    const newMessage: Message = {
      content: message.content,
      proposal: message.proposal,
      sender: sourcePlayer.id,
      time: new Date(),
      id: id,
    };

    console.log('newMessage', newMessage);
    this.findByIdAndUpdate(
      conversation.id,
      {
        $push: { messages: newMessage },
        lastMessage: newMessage,
      },
      socket,
      sourcePlayerSocketId,
      targetPlayerSocketId,
    );
  }

  async responseProposal(
    conversationId: string,
    messageId: string,
    response: 'accepted' | 'rejected',
    playerId: string,
    server: Server,
  ) {
    const session = await this.conversationModel.startSession();
    session.startTransaction();

    try {
      const conversation =
        await this.conversationModel.findById(conversationId);
      if (!messageId) {
        throw new BadRequestException('MessageId is required.');
      }
      if (!conversation) {
        throw new NotFoundException('Conversation not found.');
      }
      const message = conversation.messages.find(
        (message: Doc<Message>) =>
          message.id !== undefined && message.id === messageId,
      );
      if (!message) {
        throw new NotFoundException('Proposal not found.');
      }
      if (message.sender === playerId && response === 'accepted') {
        throw new ForbiddenException(
          'Vous ne pouvez pas répondre à votre propre proposition.',
        );
      }

      const proposal = message.proposal;
      if (!proposal) {
        throw new ForbiddenException("Ce message n'est pas une proposition.");
      }
      if (proposal.status !== 'pending') {
        throw new ForbiddenException('Cette proposition a déjà été traitée.');
      }

      const targetPlayer = await this.playerService.findOneById(
        conversation.players[0] === playerId
          ? conversation.players[1]
          : conversation.players[0],
      );
      const sourcePlayer = await this.playerService.findOneById(playerId);
      if (!sourcePlayer || !targetPlayer) {
        throw new NotFoundException('Player not found.');
      }

      if (response === 'accepted') {
        if (proposal.sourceMoney > sourcePlayer.money) {
          throw new ForbiddenException(
            'Vous ne pouvez pas accepter une proposition qui vous mettrait en négatif.',
          );
        }
        if (proposal.targetMoney > targetPlayer.money) {
          throw new ForbiddenException(
            "Vous ne pouvez pas accepter une proposition qui mettrait l'autre joueur en négatif.",
          );
        }
        if (
          proposal.sourceHouses.some(
            (house) => !sourcePlayer.houses.includes(house),
          )
        ) {
          throw new ForbiddenException(
            'Vous ne pouvez pas accepter une proposition qui inclut des maisons que vous ne possédez pas.',
          );
        }
        if (
          proposal.targetHouses.some(
            (house) => !targetPlayer.houses.includes(house),
          )
        ) {
          throw new ForbiddenException(
            "Vous ne pouvez pas accepter une proposition qui inclut des maisons que l'autre joueur ne possède pas.",
          );
        }

        // Perform the updates in separate operations
        await this.playerService.findByIdAndUpdate(
          sourcePlayer.id,
          {
            $inc: {
              money: proposal.sourceMoney - proposal.targetMoney,
            },
            $pull: { houses: { $in: proposal.sourceHouses } },
          },
          server,
        );
        if (proposal.sourceMoney - proposal.targetMoney < 0) {
          await this.playerService.generateTransaction(
            sourcePlayer.id,
            targetPlayer.id,
            proposal.sourceMoney - proposal.targetMoney,
            moneyTransactionType.TRADE,
            server,
          );
        } else if (proposal.sourceMoney - proposal.targetMoney > 0) {
          await this.playerService.generateTransaction(
            targetPlayer.id,
            sourcePlayer.id,
            proposal.targetMoney - proposal.sourceMoney,
            moneyTransactionType.TRADE,
            server,
          );
        }
        await this.playerService.findByIdAndUpdate(
          sourcePlayer.id,
          {
            $push: { houses: { $each: proposal.targetHouses } },
          },
          server,
        );
        await this.playerService.findByIdAndUpdate(
          message.sender,
          {
            $inc: {
              money: proposal.targetMoney - proposal.sourceMoney,
            },
            $pull: { houses: { $in: proposal.targetHouses } },
          },
          server,
        );
        await this.playerService.findByIdAndUpdate(
          message.sender,
          {
            $push: { houses: { $each: proposal.sourceHouses } },
          },
          server,
        );
      }

      // Update the proposal status
      const newConv = await this.conversationModel.findByIdAndUpdate(
        conversationId,
        {
          $set: { 'messages.$[elem].proposal.status': response },
        },
        {
          arrayFilters: [{ 'elem.id': messageId }],
          session,
          new: true,
        },
      );

      const targetPlayerSocketId = await this.serverService.getSocketId(
        targetPlayer.id,
      );
      const sourcePlayerSocketId = await this.serverService.getSocketId(
        sourcePlayer.id,
      );

      await server.to(targetPlayerSocketId).emit(GameEvent.NEW_MESSAGE, {
        conversation: newConv,
      });
      await server.to(sourcePlayerSocketId).emit(GameEvent.NEW_MESSAGE, {
        conversation: newConv,
      });

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error(error);
      throw new ForbiddenException(error.message);
    }
  }

  async findByIdAndUpdate(
    conversationId: string,
    update: UpdateQuery<Conversation>,
    server: Server,
    sourcePlayerSocketId: string,
    targetPlayerSocketId: string,
  ) {
    try {
      const newConv = await this.conversationModel.findByIdAndUpdate(
        conversationId,
        update,
        { new: true },
      );
      if (!newConv) {
        throw new NotFoundException('Conversation not found.');
      }

      await server.to(targetPlayerSocketId).emit(GameEvent.NEW_MESSAGE, {
        conversation: newConv,
      });
      await server.to(sourcePlayerSocketId).emit(GameEvent.NEW_MESSAGE, {
        conversation: newConv,
      });
    } catch (error) {
      throw new ForbiddenException(error.message);
    }
  }

  async deleteFromLobby(lobbyId: string) {
    await this.conversationModel.deleteMany({ lobbyId });
  }

  async findByPlayerId(id: string, page: number = 0, limit: number = 10) {
    // players field contains the id of the players in the conversation
    return this.conversationModel
      .find({ players: id })
      .sort({ 'lastMessage.time': -1 })
      .skip(page * limit)
      .limit(limit);
  }
}
