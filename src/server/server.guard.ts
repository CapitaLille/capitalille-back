import { CanActivate, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { ConstantsService } from 'src/user/constants';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ServerGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly constantsService: ConstantsService,
  ) {}

  async canActivate(
    context: any,
  ): Promise<
    boolean | any | Promise<boolean | any> | Observable<boolean | any>
  > {
    const bearerToken =
      context.args[0].handshake.headers.authorization.split(' ')[1];
    try {
      const payload: authPayload = (
        await this.jwt.verifyAsync(bearerToken, {
          secret: this.constantsService.jwtConstants.secret,
        })
      ).data;
      context.args[0].handshake.user = payload;
      return true;
    } catch (ex) {
      console.log('Unauthorized access to the server socket');
      return false;
    }
  }
}
