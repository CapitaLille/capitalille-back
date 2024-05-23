import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';

import { v4 as uuid } from 'uuid';

import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

let currentQuestion = -1;

let connectedUsers = [];

let currentPlayerAnswered = 0;

let state = 'WAITING';

@WebSocketGateway({ cors: true })
export class ServerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  questions: Array<{
    id: number;
    question: string;
    multiple: boolean;
    answers: Array<{
      id: number;
      text: string;
    }>;
    answer: Array<number>;
  }>;

  constructor() {} // @InjectModel(Question.name) private questionModel: Model<Question>,

  @SubscribeMessage('register')
  register(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { username: string },
  ) {
    const id = uuid();
    connectedUsers.push({
      id: id,
      username: data.username,
      score: 0,
      currentAnswer: [],
      rank: -1,
    });
    this.server.emit('updatePlayerCount', {
      current: currentPlayerAnswered,
      total: connectedUsers.length,
    });

    client.emit('registered', id);

    switch (state) {
      case 'VALIDATION':
        setTimeout(() => {
          client.emit('newQuestion', {
            question: this.questions[currentQuestion],
            reconnect: false,
          });
          setTimeout(() => {
            client.emit('answerValidated', {
              answer: this.questions[currentQuestion].answer,
            });
          }, 500);
        }, 500);
        break;

      case 'QUESTION':
        setTimeout(() => {
          client.emit('newQuestion', {
            question: this.questions[currentQuestion],
            reconnect: false,
          });
        }, 500);
        break;
    }
  }

  @SubscribeMessage('connectionLost')
  connectionLost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string },
  ) {
    const found = connectedUsers.find((el) => el.id === data.id);
    if (found) {
      client.emit('foundUser', { user: found, state: state });
      setTimeout(() => {
        switch (state) {
          case 'VALIDATION':
            client.emit('answerValidated', {
              answer: this.questions[currentQuestion].answer,
            });
            break;

          case 'QUESTION':
            client.emit('newQuestion', {
              question: this.questions[currentQuestion],
              reconnect: found.currentAnswer.length !== 0,
            });
            break;

          case 'SCORE':
            client.emit('showScore', connectedUsers);
            break;
        }
      }, 500);
    }
  }

  @SubscribeMessage('startQuiz')
  async startQuiz(): Promise<WsResponse<boolean>> {
    // this.questions = await this.questionModel.find();
    currentQuestion = 0;
    currentPlayerAnswered = 0;
    state = 'QUESTION';
    this.server.emit('newQuestion', {
      question: this.questions[currentQuestion],
      reconnect: false,
    });
    this.server.emit('questionStats', {
      current: currentQuestion,
      total: this.questions.length,
    });
    return { event: 'hasStartedQuiz', data: true };
  }

  @SubscribeMessage('answerQuiz')
  answerQuiz(@MessageBody() data: { answer: Array<number>; userID: string }) {
    const curUser = connectedUsers.find((el) => el.id === data.userID);
    curUser.currentAnswer = data.answer;
    currentPlayerAnswered++;
    this.server.emit('updatePlayerCount', {
      current: currentPlayerAnswered,
      total: connectedUsers.length,
    });
    data.answer.map((answer) => {
      if (
        this.questions[currentQuestion].answer.find((e) => e === answer) !==
        undefined
      ) {
        curUser.score = curUser.score + 10;
      } else {
        curUser.score = curUser.score - 5;
      }
    });
  }

  @SubscribeMessage('validateAnswer')
  validateAnswer(): WsResponse<boolean> {
    state = 'VALIDATION';
    this.server.emit('answerValidated', {
      answer: this.questions[currentQuestion].answer,
    });
    return { event: 'hasValidatedAnswer', data: true };
  }

  @SubscribeMessage('nextQuestion')
  nextQuestion(): WsResponse<boolean> {
    connectedUsers.map((e) => {
      e.currentAnswer = [];
    });

    if (currentQuestion < this.questions.length - 1) {
      currentQuestion++;
      currentPlayerAnswered = 0;
      state = 'QUESTION';
      this.server.emit('newQuestion', {
        question: this.questions[currentQuestion],
        reconnect: false,
      });
      this.server.emit('questionStats', {
        current: currentQuestion,
        total: this.questions.length,
      });
      this.server.emit('resetQuestion', true);
      return { event: 'hasNextQuestion', data: true };
    } else {
      currentQuestion++;
      state = 'SCORE';
      this.sortScores();
      this.server.emit('showScore', connectedUsers);
      return { event: 'hasNextQuestion', data: true };
    }
  }

  @SubscribeMessage('adminReset')
  adminReset() {
    state = 'WAITING';
    currentQuestion = -1;
    connectedUsers = [];
    currentPlayerAnswered = 0;
    this.server.emit('reset');
  }

  private sortScores() {
    connectedUsers = connectedUsers.sort((e1, e2) => {
      return e1.score > e2.score ? -1 : 1;
    });

    let curRank = 1;
    for (let i = 0; i < connectedUsers.length; i++) {
      if (i === 0) {
        connectedUsers[i].rank = curRank;
      } else if (connectedUsers[i - 1].score > connectedUsers[i].score) {
        connectedUsers[i].rank = ++curRank;
      } else {
        connectedUsers[i].rank = curRank;
      }
    }
  }

  handleConnection(): any {
    this.server.emit('updatePlayerCount', {
      current: currentPlayerAnswered,
      total: connectedUsers.length,
    });
  }

  handleDisconnect(): any {}
}
