import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, startSession } from 'mongoose';
import { User } from './user.schema';
import * as bcrypt from 'bcrypt';
import { bcryptConstants } from './constants';
import { CreatePushDto } from './dto/create-push.dto';
import { Notification } from './user.schema';
import { nanoid } from 'nanoid';
@Injectable()
export class UserService {
  constructor(@InjectModel('User') private readonly userModel: Model<User>) {}

  async findOne(id: number) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user._id,
      email: user.email,
      nickname: user.nickname,
      lobbys: user.lobbys,
      credit: user.credit,
      pp: user.pp,
    };
  }

  async pushNotification(notification: CreatePushDto) {
    const from = await this.userModel.findById(notification.from);
    const to = await this.userModel.findById(notification.to);
    if (!from) {
      throw new NotFoundException("Notification's sender not found");
    }
    if (!to) {
      throw new NotFoundException("Notification's receiver not found");
    }
    const newNotification: Notification = {
      uid: nanoid(20),
      from: notification.from,
      attached: notification.attached,
      type: notification.type,
      date: new Date(),
      read: false,
    };
    to.notifications.push(newNotification);
    await to.save();
    return HttpStatus.OK;
  }

  async addFriend(
    id: mongoose.Types.ObjectId,
    friendId: mongoose.Types.ObjectId,
  ) {
    const user = await this.userModel.findById(id);
    const friend = await this.userModel.findById(friendId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!friend) {
      throw new NotFoundException('Friend not found');
    }
    if (user.friends.includes(friendId) || friend.friends.includes(id)) {
      throw new ConflictException('Friend already added');
    }

    user.friends.push(friendId);
    friend.friends.push(id);

    let session: ClientSession = null;
    try {
      session = await startSession();
      session.startTransaction();

      // Vos opérations MongoDB ici
      // Exemple :
      const operations = [];
      operations.push(user.save());
      operations.push(friend.save());
      await Promise.all(operations);

      // Si toutes les opérations réussissent, commit la transaction
      await session.commitTransaction();
    } catch (error) {
      // Si une opération échoue, annule la transaction
      await session.abortTransaction();
      throw error; // Optionnel : relancez l'erreur pour la gérer plus haut
    } finally {
      // Fermez la session
      session.endSession();
    }

    return HttpStatus.OK;
  }

  async removeFriend(
    id: mongoose.Types.ObjectId,
    friendId: mongoose.Types.ObjectId,
  ) {
    const user = await this.userModel.findById(id);
    const friend = await this.userModel.findById(friendId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!friend) {
      throw new NotFoundException('Friend not found');
    }
    if (!user.friends.includes(friendId) || !friend.friends.includes(id)) {
      throw new ConflictException('These users are not friends');
    }

    user.friends.splice(user.friends.indexOf(friendId), 1);
    friend.friends.splice(friend.friends.indexOf(id), 1);

    let session: ClientSession = null;
    try {
      session = await startSession();
      session.startTransaction();

      // Vos opérations MongoDB ici
      // Exemple :
      const operations = [];
      operations.push(user.save());
      operations.push(friend.save());
      await Promise.all(operations);

      // Si toutes les opérations réussissent, commit la transaction
      await session.commitTransaction();
    } catch (error) {
      // Si une opération échoue, annule la transaction
      await session.abortTransaction();
      throw error; // Optionnel : relancez l'erreur pour la gérer plus haut
    } finally {
      // Fermez la session
      session.endSession();
    }

    return HttpStatus.OK;
  }

  async answerNotification(
    id: mongoose.Types.ObjectId,
    notificationId: string,
    answer: boolean,
  ) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const notification = user.notifications.find(
      (n) => n.uid === notificationId,
    );
    switch (notification.type) {
      case 'friend_request':
        if (answer) {
          this.addFriend(id, notification.from);
          user.friends.push(notification.from);
          await user.save();
        }
        break;
      case 'gameInvite':
        if (answer) {
          user.lobbys.push(notification.attached);
          await user.save();
        }
        break;
      default:
        throw new ConflictException('Invalid notification type');
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    if (!(await this.userModel.findById(id))) {
      throw new NotFoundException('User not found');
    }
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(
        updateUserDto.password,
        bcryptConstants.salt,
      );
    }
    await this.userModel.findByIdAndUpdate(id, updateUserDto);
    return HttpStatus.OK;
  }

  async remove(id: number) {
    if (!(await this.userModel.findById(id))) {
      throw new NotFoundException('User not found');
    }
    await this.userModel.findByIdAndDelete(id);
    return HttpStatus.OK;
  }
}
