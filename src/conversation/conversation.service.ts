import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Conversation, Message } from './conversation.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { Lobby } from 'src/lobby/lobby.schema';
import { ServerGuardSocket } from 'src/server/server.gateway';
import { PlayerService } from 'src/player/player.service';
import { Doc, GameEvent } from 'src/server/server.type';
import { Player } from 'src/player/player.schema';
import { Server } from 'socket.io';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel('Conversation')
    private readonly conversationModel: Model<Conversation>,
    private readonly playerService: PlayerService,
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
      });
    }
    if (message.proposal) {
      if (
        message.proposal.sourceHouses.some(
          (house) => !sourcePlayer.houses.includes(house),
        )
      ) {
        throw new BadRequestException(
          'Vous ne pouvez inclure des maisons que vous ne possédez pas dans votre proposition.',
        );
      }
      if (
        message.proposal.targetHouses.some(
          (house) => !targetPlayer.houses.includes(house),
        )
      ) {
        throw new BadRequestException(
          "Vous ne pouvez inclure des maisons que l'autre joueur ne possède pas dans votre proposition.",
        );
      }
      if (message.proposal.sourceMoney > sourcePlayer.money) {
        throw new BadRequestException(
          "Vous ne pouvez proposer plus d'argent que ce que vous avez.",
        );
      }
    }
    if (!message.content && !message.proposal) {
      throw new BadRequestException(
        'Vous devez envoyer un message ou une offre.',
      );
    }

    const newMessage = {
      content: message.content,
      proposal: message.proposal,
      sender: sourcePlayer.id,
      time: new Date(),
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
      throw new NotImplementedException(
        'findByIdAndUpdateConv : ' + error.message,
      );
    }
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
