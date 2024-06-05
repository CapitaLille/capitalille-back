import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, startSession } from 'mongoose';
import {
  Achievement,
  AchievementClass,
  AchievementType,
  User,
} from './user.schema';
import * as bcrypt from 'bcrypt';
import { bcryptConstants } from './constants';
import { CreatePushDto } from './dto/create-push.dto';
import { Notification } from './user.schema';
import { nanoid } from 'nanoid';
import { LobbyService } from 'src/lobby/lobby.service';
import { ConfigService } from '@nestjs/config';
import { FilesAzureService } from 'src/fileazure/filesAzure.service';

@Injectable()
export class UserService {
  constructor(
    private readonly configService: ConfigService,
    private readonly fileService: FilesAzureService,
    @InjectModel('User') private readonly userModel: Model<User>,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {}

  async findOne(userId: string) {
    return await this.userModel.findById(userId);
  }

  async searchUsers(search: string, page: number = -1) {
    if (page !== -1) {
      return await this.userModel
        .find({ nickname: { $regex: search } })
        .limit(10);
    }
    return await this.userModel
      .find({ nickname: { $regex: search } })
      .limit(10)
      .skip(page * 10);
  }

  async searchFriends(userId: string, search: string, page: number = -1) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (page !== -1) {
      return await this.userModel
        .find({ nickname: { $regex: search }, _id: { $in: user.friends } })
        .limit(10);
    }
    return await this.userModel
      .find({ nickname: { $regex: search }, _id: { $in: user.friends } })
      .limit(10)
      .skip(page * 10);
  }

  async findOneByEmail(email: string) {
    console.log('email', email);
    return await this.userModel.findOne({ email });
  }

  async requestFriend(id: string, friendId: string) {
    const user = await this.userModel.findById(id);
    const friend = await this.userModel.findById(friendId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!friend) {
      throw new NotFoundException('Friend not found');
    }
    if (id === friendId) {
      throw new ConflictException('You cannot add yourself as a friend');
    }
    if (user.friends.includes(friendId) || friend.friends.includes(id)) {
      throw new ConflictException('Friend already added');
    }
    const notificationDto: CreatePushDto = {
      from: id,
      to: friendId,
      attached: null,
      type: 'friendRequest',
    };
    await this.pushNotification(notificationDto);
    return HttpStatus.OK;
  }

  private async addFriend(id: string, friendId: string) {
    const user = await this.userModel.findById(id);
    const friend = await this.userModel.findById(friendId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!friend) {
      throw new NotFoundException('Friend not found');
    }
    if (id === friendId) {
      throw new ConflictException('You cannot add yourself as a friend');
    }
    if (user.friends.includes(friendId) || friend.friends.includes(id)) {
      throw new ConflictException('Friend already added');
    }
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const operations = [];
      operations.push(
        this.userModel.findByIdAndUpdate(user.id, {
          $push: { friends: friendId },
        }),
      );
      operations.push(
        this.userModel.findByIdAndUpdate(friend.id, {
          $push: { friends: id },
        }),
      );
      await Promise.all(operations);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error; // Optionnel : relancez l'erreur pour la gérer plus haut
    } finally {
      session.endSession();
    }

    return HttpStatus.OK;
  }

  async removeFriend(id: string, friendId: string) {
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
    const session = await this.connection.startSession();
    try {
      session.startTransaction();

      const operations = [];
      operations.push(
        this.userModel.findByIdAndUpdate(user.id, {
          $pull: { friends: friendId },
        }),
      );
      operations.push(
        this.userModel.findByIdAndUpdate(friend.id, {
          $pull: { friends: id },
        }),
      );
      await Promise.all(operations);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error; // Optionnel : relancez l'erreur pour la gérer plus haut
    } finally {
      session.endSession();
    }

    return HttpStatus.OK;
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
    await this.userModel.findByIdAndUpdate(to.id, {
      $push: { notifications: newNotification },
    });
    return HttpStatus.OK;
  }

  async findSomeFromLobby(lobbyId: string, limit: number = -1) {
    if (limit === -1) {
      return await this.userModel.find({ lobbies: lobbyId }).exec();
    }
    return await this.userModel.find({ $in: lobbyId }).limit(limit).exec();
  }

  async answerNotification(
    userId: string,
    notificationId: string, // nanoid.
    answer: boolean,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const notification = user.notifications.find(
      (n) => n.uid === notificationId,
    );
    switch (notification.type) {
      case 'friendRequest':
        if (answer) {
          this.addFriend(userId, notification.from);
        }
        break;
      case 'gameInvite':
        if (answer) {
          // this.lobbyService.addPlayer(notification.attached, userId);
        }
        break;
      default:
        throw new ConflictException('Invalid notification type');
    }
    await this.userModel.findByIdAndUpdate(userId, {
      notifications: user.notifications,
    });
    return HttpStatus.OK;
  }

  async update(userId: string, updateUserDto: UpdateUserDto) {
    if (!(await this.userModel.findById(userId))) {
      throw new NotFoundException('User not found');
    }
    await this.userModel.findByIdAndUpdate(userId, updateUserDto);
    return HttpStatus.OK;
  }

  async findByIdAndUpdate(userId: string, update: mongoose.UpdateQuery<User>) {
    if (!(await this.userModel.findById(userId))) {
      throw new NotFoundException('User not found');
    }
    await this.userModel.findByIdAndUpdate(userId, update);
    return HttpStatus.OK;
  }

  async statisticsUpdate(userId: string, achievement: Achievement) {
    switch (achievement) {
      case AchievementType.auctionWinner:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { auctionsWon: 1 },
        });
        break;
      case AchievementType.auctionBuyer:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { auctionsBought: 1 },
        });
        break;
      case AchievementType.copsComplainer:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { copsComplained: 1 },
        });
        break;
      case AchievementType.diceLauncher:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { dicesLaunched: 1 },
        });
        break;
      case AchievementType.gameCreator:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { gamesCreated: 1 },
        });
        break;
      case AchievementType.monumentsRestorer:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { monumentsRestored: 1 },
        });
        break;
      case AchievementType.payMe:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { moneyReceived: 1 },
        });
        break;
      case AchievementType.playGame:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { gamesPlayed: 1 },
        });
        break;
      case AchievementType.winGame:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { gamesWon: 1 },
        });
        break;
      case AchievementType.gambler:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { casinos: 1 },
        });
        break;
      case AchievementType.liveOnLoan:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { loans: 1 },
        });
        break;
      case AchievementType.frauder:
        await this.userModel.findByIdAndUpdate(userId, {
          $inc: { rentFraud: 1 },
        });
        break;
      default:
        throw new ConflictException('Invalid achievement');
    }
    return HttpStatus.OK;
  }

  async getAchievements(userId: string) {
    const user = await this.userModel.findById(userId);
    let allAchievements = Achievement.achievements;
    if (!user) {
      throw new NotFoundException('User not found');
    }
    let achievementsCompleted = [];
    let achievementsUncompleted = [];

    for (const achievement of allAchievements) {
      const findCompleted = user.achievements.find(
        (e) => e.name === achievement.name,
      );
      if (findCompleted) {
        const newUncompletedAchievement = {
          name: findCompleted.name,
          level: findCompleted.level.filter(
            (e) => !findCompleted.level.includes(e),
          ),
        };
        if (newUncompletedAchievement.level.length > 0) {
          achievementsUncompleted.push(newUncompletedAchievement);
        }
        achievementsCompleted.push(findCompleted);
      } else {
        achievementsUncompleted.push(achievement);
      }
    }
    return { achievementsCompleted, achievementsUncompleted };
  }

  async claimAchievement(
    userId: string,
    achievement: AchievementType,
    level: number,
  ) {
    const levelCount = [1, 10, 100, 250, 500];
    if (level < 0 || level > 4) {
      throw new ConflictException('Invalid achievement level');
    }
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let achievementClass;
    switch (achievement) {
      case AchievementType.auctionWinner:
        achievementClass = Achievement.auctionWinner;
        if (user.statistics.auctionsWon < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough auctions won to claim this achievement.",
          );
        }
        if (!Achievement.auctionWinner.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.auctionBuyer:
        achievementClass = Achievement.auctionBuyer;
        if (user.statistics.auctionsBought < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough auctions bought to claim this achievement.",
          );
        }
        if (!Achievement.auctionBuyer.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.copsComplainer:
        achievementClass = Achievement.copsComplainer;
        if (user.statistics.complaints < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough cops complained to claim this achievement.",
          );
        }
        if (!Achievement.copsComplainer.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.diceLauncher:
        achievementClass = Achievement.diceLauncher;
        if (user.statistics.dicesLaunched < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough dices launched to claim this achievement.",
          );
        }
        if (!Achievement.diceLauncher.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.gameCreator:
        achievementClass = Achievement.gameCreator;
        if (user.statistics.gamesCreated < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough games created to claim this achievement.",
          );
        }
        if (!Achievement.gameCreator.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.monumentsRestorer:
        achievementClass = Achievement.monumentsRestorer;
        if (user.statistics.monumentsRestored < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough monuments restored to claim this achievement.",
          );
        }
        if (!Achievement.monumentsRestorer.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.payMe:
        achievementClass = Achievement.payMe;
        if (user.statistics.moneyReceived < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough money received to claim this achievement.",
          );
        }
        if (!Achievement.payMe.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.playGame:
        achievementClass = Achievement.playGame;
        if (user.statistics.gamesPlayed < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough games played to claim this achievement.",
          );
        }
        if (!Achievement.playGame.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.winGame:
        achievementClass = Achievement.winGame;
        if (user.statistics.gamesWon < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough games won to claim this achievement.",
          );
        }
        if (!Achievement.winGame.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.gambler:
        achievementClass = Achievement.gambler;
        if (user.statistics.casinos < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough casinos to claim this achievement.",
          );
        }
        if (!Achievement.gambler.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.liveOnLoan:
        achievementClass = Achievement.liveOnLoan;
        if (user.statistics.loans < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough loans to claim this achievement.",
          );
        }
        if (!Achievement.liveOnLoan.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      case AchievementType.frauder:
        achievementClass = Achievement.frauder;
        if (user.statistics.rentFraud < levelCount[level]) {
          throw new ConflictException(
            "You don't have enough rent fraud to claim this achievement.",
          );
        }
        if (!Achievement.frauder.level.includes(level)) {
          throw new ConflictException('Invalid achievement level');
        }
        break;
      default:
        throw new ConflictException('Invalid achievement');
    }
    const findAchievement = user.achievements.find(
      (e) => e.name === achievement,
    );
    if (user.achievements.includes(achievementClass)) {
      if (findAchievement.level.includes(level)) {
        throw new ConflictException('Achievement already claimed');
      }
    }
    if (level > 4) {
      throw new ConflictException('Invalid achievement level');
    }
    const achievementInstance = new AchievementClass({
      name: achievement,
      level: [...findAchievement.level, level],
    });
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { achievements: { name: achievementInstance.name } },
    });
    await this.userModel.findByIdAndUpdate(userId, {
      $push: { achievements: achievementInstance },
    });
    return HttpStatus.OK;
  }

  async updatePp(userId: string, file: Express.Multer.File) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const containerName = this.configService.get('PROFILE_PICTURES_CONTAINER');
    if (user.pp !== '') {
      console.log('delete', user.pp);
      await this.fileService.deleteFile(user.pp, containerName);
      await this.userModel.findByIdAndUpdate(userId, {
        pp: '',
      });
    }
    console.log('upload', file);
    const upload = await this.fileService.uploadFile(file, containerName);
    console.log('upload', upload);
    await this.userModel.findByIdAndUpdate(userId, {
      pp: upload,
    });
    return { pp: upload };
  }

  async remove(userId: string) {
    if (!(await this.userModel.findById(userId))) {
      throw new NotFoundException('User not found');
    }
    await this.userModel.updateMany(
      { friends: userId },
      { $pull: { friends: userId } },
    );
    await this.userModel.findByIdAndUpdate(userId, {
      friends: [],
      lobbies: [],
      notifications: [],
      email: 'deleted',
      pp: '',
      nickname: 'deleted',
      trophies: 0,
      achievements: [],
      statistics: {
        auctionsBought: 0,
        auctionsWon: 0,
        complaints: 0,
        dicesLaunched: 0,
        gamesCreated: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        monumentsRestored: 0,
        moneyReceived: 0,
        casinos: 0,
        loans: 0,
        rentFraud: 0,
      },
      credit: 0,
    });
    return HttpStatus.OK;
  }

  async getFriends(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return await this.userModel.find({ _id: { $in: user.friends } });
  }

  async updateUserPassword(email: string, newPassword: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const hashedPassword = await bcrypt
      .hash(newPassword, bcryptConstants.salt)
      .catch((e) => {
        throw new ConflictException(e.message);
      });
    await this.userModel.findOneAndUpdate(
      { email },
      { password: hashedPassword },
    );
    return HttpStatus.OK;
  }
}
