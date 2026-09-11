import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({ where: { username } });
    // 演示项目使用明文口令；生产环境请替换为 bcrypt 哈希
    if (!user || user.password !== password) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      token: await this.jwt.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }
}
