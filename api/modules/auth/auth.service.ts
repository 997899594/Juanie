import { Injectable, UnauthorizedException, ConflictException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private usersService: UsersService,
    @Inject(JwtService) private jwtService: JwtService,
    @Inject(ConfigService) private configService: ConfigService,
    @Inject(RedisService) private redisService: RedisService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    // Check if user exists
    const existingUser = await this.usersService.findByEmail(loginDto.email);
    if (!existingUser) {
      throw new UnauthorizedException('用户不存在，请检查邮箱地址');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(loginDto.password, existingUser.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误，请重新输入');
    }

    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('登录失败，请检查用户名和密码');
    }

    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role 
    };
    
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
    });

    // Store refresh token in Redis (with error handling)
    try {
      await this.redisService.set(
        `refresh_token:${user.id}`,
        refreshToken,
        30 * 24 * 60 * 60 // 30 days in seconds
      );
    } catch (error) {
      console.warn('Redis not available, continuing without refresh token storage:', error.message);
    }

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if name is taken
    const existingName = await this.usersService.findByName(registerDto.username);
    if (existingName) {
      throw new ConflictException('Username is already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Generate tokens
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role 
    };
    
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '30d',
    });

    // Store refresh token in Redis
    await this.redisService.set(
      `refresh_token:${user.id}`,
      refreshToken,
      30 * 24 * 60 * 60 // 30 days in seconds
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const userId = payload.sub;

      // Check if refresh token exists in Redis (with error handling)
      try {
        const storedToken = await this.redisService.get(`refresh_token:${userId}`);
        if (!storedToken || storedToken !== refreshToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }
      } catch (error) {
        console.warn('Redis not available, skipping refresh token validation:', error.message);
      }

      // Get user data
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const newPayload = { 
        sub: user.id, 
        email: user.email, 
        role: user.role 
      };
      
      const accessToken = this.jwtService.sign(newPayload);

      return {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Remove refresh token from Redis
    await this.redisService.del(`refresh_token:${userId}`);
    return { message: 'Logged out successfully' };
  }
}