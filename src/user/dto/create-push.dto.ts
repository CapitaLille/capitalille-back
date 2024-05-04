import mongoose from 'mongoose';

export class CreatePushDto {
  from: mongoose.Types.ObjectId;
  to: mongoose.Types.ObjectId;
  attached: mongoose.Types.ObjectId;
  type:
    | 'gameInvite'
    | 'gameStart'
    | 'gameEnd'
    | 'gameTurn'
    | 'gameAction'
    | 'gameMessage';
}
