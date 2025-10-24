import { Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import * as crypto from 'crypto';

// DID (Decentralized Identifier) Schema
export const DIDSchema = z.object({
  id: z.string().regex(/^did:[a-z0-9]+:[a-zA-Z0-9._-]+$/), // DID格式
  method: z.string(), // DID方法 (eth, btc, sol等)
  publicKey: z.string(),
  privateKey: z.string().optional(), // 仅在本地存储
  address: z.string(), // 区块链地址
  metadata: z.object({
    created: z.date(),
    updated: z.date(),
    version: z.string().default('1.0'),
    controller: z.string().optional(),
    service: z.array(z.object({
      id: z.string(),
      type: z.string(),
      serviceEndpoint: z.string(),
    })).optional(),
  }),
});

// 可验证凭证Schema
export const VerifiableCredentialSchema = z.object({
  '@context': z.array(z.string()).default(['https://www.w3.org/2018/credentials/v1']),
  id: z.string(),
  type: z.array(z.string()),
  issuer: z.string(), // DID of issuer
  issuanceDate: z.date(),
  expirationDate: z.date().optional(),
  credentialSubject: z.record(z.string(), z.any()),
  proof: z.object({
    type: z.string(),
    created: z.date(),
    verificationMethod: z.string(),
    proofPurpose: z.string(),
    signature: z.string(),
  }),
});

// 可验证展示Schema
export const VerifiablePresentationSchema = z.object({
  '@context': z.array(z.string()).default(['https://www.w3.org/2018/credentials/v1']),
  id: z.string(),
  type: z.array(z.string()).default(['VerifiablePresentation']),
  holder: z.string(), // DID of holder
  verifiableCredential: z.array(VerifiableCredentialSchema),
  proof: z.object({
    type: z.string(),
    created: z.date(),
    verificationMethod: z.string(),
    proofPurpose: z.string().default('authentication'),
    challenge: z.string(),
    signature: z.string(),
  }),
});

// Web3认证会话Schema
export const Web3SessionSchema = z.object({
  id: z.string(),
  did: z.string(),
  address: z.string(),
  chainId: z.number(),
  nonce: z.string(),
  message: z.string(),
  signature: z.string(),
  timestamp: z.date(),
  expiresAt: z.date(),
  permissions: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 智能合约交互Schema
export const SmartContractSchema = z.object({
  address: z.string(),
  abi: z.array(z.any()),
  chainId: z.number(),
  network: z.string(),
  deployedAt: z.date().optional(),
  verified: z.boolean().default(false),
});

export type DID = z.infer<typeof DIDSchema>;
export type VerifiableCredential = z.infer<typeof VerifiableCredentialSchema>;
export type VerifiablePresentation = z.infer<typeof VerifiablePresentationSchema>;
export type Web3Session = z.infer<typeof Web3SessionSchema>;
export type SmartContract = z.infer<typeof SmartContractSchema>;

/**
 * DID管理器
 * 管理去中心化身份标识符
 */
@Injectable()
export class DIDManager {
  private readonly logger = new Logger(DIDManager.name);
  private readonly dids = new Map<string, DID>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建新的DID
   */
  async createDID(method = 'eth'): Promise<DID> {
    const keyPair = this.generateKeyPair();
    const address = this.deriveAddress(keyPair.publicKey, method);
    
    const did: DID = DIDSchema.parse({
      id: `did:${method}:${address}`,
      method,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      address,
      metadata: {
        created: new Date(),
        updated: new Date(),
        version: '1.0',
      },
    });

    this.dids.set(did.id, did);
    this.eventEmitter.emit('web3.did.created', did);
    
    this.logger.log(`DID created: ${did.id}`);
    return did;
  }

  /**
   * 解析DID文档
   */
  async resolveDID(didId: string): Promise<DID | null> {
    // 首先检查本地存储
    const localDID = this.dids.get(didId);
    if (localDID) {
      return localDID;
    }

    // 尝试从区块链或DID注册表解析
    try {
      const resolvedDID = await this.resolveFromBlockchain(didId);
      if (resolvedDID) {
        this.dids.set(didId, resolvedDID);
        return resolvedDID;
      }
    } catch (error) {
      this.logger.error(`Failed to resolve DID ${didId}:`, error);
    }

    return null;
  }

  /**
   * 更新DID文档
   */
  async updateDID(didId: string, updates: Partial<DID['metadata']>): Promise<boolean> {
    const did = this.dids.get(didId);
    if (!did) {
      return false;
    }

    did.metadata = {
      ...did.metadata,
      ...updates,
      updated: new Date(),
    };

    this.eventEmitter.emit('web3.did.updated', did);
    return true;
  }

  /**
   * 验证DID所有权
   */
  async verifyDIDOwnership(didId: string, signature: string, message: string): Promise<boolean> {
    const did = await this.resolveDID(didId);
    if (!did) {
      return false;
    }

    return this.verifySignature(message, signature, did.publicKey);
  }

  private generateKeyPair(): { publicKey: string; privateKey: string } {
    // 简化的密钥生成（实际中应使用secp256k1等标准曲线）
    const keyPair = crypto.generateKeyPairSync('ec' as any, {
      namedCurve: 'secp256k1',
      publicKeyEncoding: { type: 'spki', format: 'hex' },
      privateKeyEncoding: { type: 'pkcs8', format: 'hex' },
    });

    return {
      publicKey: (keyPair.publicKey as unknown) as string,
      privateKey: (keyPair.privateKey as unknown) as string,
    };
  }

  private deriveAddress(publicKey: string, method: string): string {
    // 简化的地址派生（实际中根据不同区块链有不同算法）
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    return hash.substring(0, 40); // 取前20字节作为地址
  }

  private async resolveFromBlockchain(didId: string): Promise<DID | null> {
    // 模拟从区块链解析DID
    // 实际实现中会调用相应的区块链RPC或DID注册表
    await new Promise(resolve => setTimeout(resolve, 100));
    return null;
  }

  private verifySignature(message: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      
      const publicKeyObj = crypto.createPublicKey({
        key: Buffer.from(publicKey, 'hex'),
        format: 'der',
        type: 'spki',
      });
      
      return verify.verify(publicKeyObj, signature, 'hex');
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }
}

/**
 * 可验证凭证管理器
 * 管理可验证凭证的签发、验证和撤销
 */
@Injectable()
export class VerifiableCredentialManager {
  private readonly logger = new Logger(VerifiableCredentialManager.name);
  private readonly credentials = new Map<string, VerifiableCredential>();
  private readonly revokedCredentials = new Set<string>();

  constructor(
    private readonly didManager: DIDManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 签发可验证凭证
   */
  async issueCredential(
    issuerDID: string,
    subjectDID: string,
    credentialData: Record<string, any>,
    type: string[] = ['VerifiableCredential'],
    expirationDate?: Date,
  ): Promise<VerifiableCredential> {
    const issuer = await this.didManager.resolveDID(issuerDID);
    if (!issuer) {
      throw new Error(`Issuer DID not found: ${issuerDID}`);
    }

    const credentialId = this.generateCredentialId();
    const issuanceDate = new Date();

    // 创建凭证主体
    const credentialSubject = {
      id: subjectDID,
      ...credentialData,
    };

    // 创建证明
    const proof = await this.createProof(
      issuer,
      credentialId,
      credentialSubject,
      issuanceDate,
    );

    const credential: VerifiableCredential = VerifiableCredentialSchema.parse({
      id: credentialId,
      type,
      issuer: issuerDID,
      issuanceDate,
      expirationDate,
      credentialSubject,
      proof,
    });

    this.credentials.set(credentialId, credential);
    this.eventEmitter.emit('web3.credential.issued', credential);
    
    this.logger.log(`Credential issued: ${credentialId}`);
    return credential;
  }

  /**
   * 验证可验证凭证
   */
  async verifyCredential(credential: VerifiableCredential): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    // 检查是否被撤销
    if (this.revokedCredentials.has(credential.id)) {
      return { valid: false, reason: 'Credential has been revoked' };
    }

    // 检查过期时间
    if (credential.expirationDate && new Date() > credential.expirationDate) {
      return { valid: false, reason: 'Credential has expired' };
    }

    // 验证签发者DID
    const issuer = await this.didManager.resolveDID(credential.issuer);
    if (!issuer) {
      return { valid: false, reason: 'Issuer DID not found' };
    }

    // 验证数字签名
    const isValidSignature = await this.verifyProof(credential, issuer);
    if (!isValidSignature) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
  }

  /**
   * 撤销可验证凭证
   */
  async revokeCredential(credentialId: string, issuerDID: string): Promise<boolean> {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      return false;
    }

    if (credential.issuer !== issuerDID) {
      throw new UnauthorizedException('Only the issuer can revoke this credential');
    }

    this.revokedCredentials.add(credentialId);
    this.eventEmitter.emit('web3.credential.revoked', { credentialId, issuerDID });
    
    this.logger.log(`Credential revoked: ${credentialId}`);
    return true;
  }

  /**
   * 创建可验证展示
   */
  async createPresentation(
    holderDID: string,
    credentials: VerifiableCredential[],
    challenge: string,
  ): Promise<VerifiablePresentation> {
    const holder = await this.didManager.resolveDID(holderDID);
    if (!holder) {
      throw new Error(`Holder DID not found: ${holderDID}`);
    }

    const presentationId = this.generatePresentationId();
    
    // 创建展示证明
    const proof = await this.createPresentationProof(
      holder,
      presentationId,
      credentials,
      challenge,
    );

    const presentation: VerifiablePresentation = VerifiablePresentationSchema.parse({
      id: presentationId,
      holder: holderDID,
      verifiableCredential: credentials,
      proof,
    });

    this.eventEmitter.emit('web3.presentation.created', presentation);
    return presentation;
  }

  private async createProof(
    issuer: DID,
    credentialId: string,
    credentialSubject: any,
    issuanceDate: Date,
  ): Promise<VerifiableCredential['proof']> {
    const message = JSON.stringify({
      id: credentialId,
      subject: credentialSubject,
      issuanceDate: issuanceDate.toISOString(),
    });

    const signature = this.signMessage(message, issuer.privateKey!);

    return {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date(),
      verificationMethod: `${issuer.id}#keys-1`,
      proofPurpose: 'assertionMethod',
      signature,
    };
  }

  private async createPresentationProof(
    holder: DID,
    presentationId: string,
    credentials: VerifiableCredential[],
    challenge: string,
  ): Promise<VerifiablePresentation['proof']> {
    const message = JSON.stringify({
      id: presentationId,
      credentials: credentials.map(c => c.id),
      challenge,
    });

    const signature = this.signMessage(message, holder.privateKey!);

    return {
      type: 'EcdsaSecp256k1Signature2019',
      created: new Date(),
      verificationMethod: `${holder.id}#keys-1`,
      proofPurpose: 'authentication',
      challenge,
      signature,
    };
  }

  private async verifyProof(credential: VerifiableCredential, issuer: DID): Promise<boolean> {
    const message = JSON.stringify({
      id: credential.id,
      subject: credential.credentialSubject,
      issuanceDate: credential.issuanceDate.toISOString(),
    });

    return this.verifySignature(message, credential.proof.signature, issuer.publicKey);
  }

  private signMessage(message: string, privateKey: string): string {
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();
    
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'hex'),
      format: 'der',
      type: 'pkcs8',
    });
    
    return sign.sign(privateKeyObj, 'hex');
  }

  private verifySignature(message: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      
      const publicKeyObj = crypto.createPublicKey({
        key: Buffer.from(publicKey, 'hex'),
        format: 'der',
        type: 'spki',
      });
      
      return verify.verify(publicKeyObj, signature, 'hex');
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  private generateCredentialId(): string {
    return `urn:uuid:${crypto.randomUUID()}`;
  }

  private generatePresentationId(): string {
    return `urn:uuid:${crypto.randomUUID()}`;
  }
}

/**
 * Web3认证服务
 * 实现基于区块链的身份验证
 */
@Injectable()
export class Web3AuthService implements OnModuleInit {
  private readonly logger = new Logger(Web3AuthService.name);
  private readonly sessions = new Map<string, Web3Session>();
  private readonly nonces = new Map<string, { nonce: string; expiresAt: Date }>();

  constructor(
    private readonly didManager: DIDManager,
    private readonly credentialManager: VerifiableCredentialManager,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.startSessionCleanup();
    this.logger.log('Web3 Auth Service initialized');
  }

  /**
   * 生成认证挑战
   */
  async generateChallenge(address: string): Promise<{
    nonce: string;
    message: string;
    expiresAt: Date;
  }> {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
    
    const message = `Sign this message to authenticate with your wallet.\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    this.nonces.set(address, { nonce, expiresAt });

    return { nonce, message, expiresAt };
  }

  /**
   * 验证签名并创建会话
   */
  async authenticateWithSignature(
    address: string,
    signature: string,
    chainId: number,
  ): Promise<Web3Session> {
    const nonceData = this.nonces.get(address);
    if (!nonceData) {
      throw new UnauthorizedException('No challenge found for this address');
    }

    if (new Date() > nonceData.expiresAt) {
      this.nonces.delete(address);
      throw new UnauthorizedException('Challenge has expired');
    }

    const message = `Sign this message to authenticate with your wallet.\n\nNonce: ${nonceData.nonce}\nTimestamp: ${new Date().toISOString()}`;

    // 验证签名（简化实现）
    const isValidSignature = await this.verifyWalletSignature(address, message, signature);
    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    // 创建或获取DID
    let did = await this.findDIDByAddress(address);
    if (!did) {
      did = await this.didManager.createDID('eth');
    }

    // 创建会话
    const session: Web3Session = Web3SessionSchema.parse({
      id: this.generateSessionId(),
      did: did.id,
      address,
      chainId,
      nonce: nonceData.nonce,
      message,
      signature,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
      permissions: ['read', 'write'],
    });

    this.sessions.set(session.id, session);
    this.nonces.delete(address);

    this.eventEmitter.emit('web3.session.created', session);
    this.logger.log(`Web3 session created for address: ${address}`);

    return session;
  }

  /**
   * 使用可验证凭证认证
   */
  async authenticateWithCredential(
    presentation: VerifiablePresentation,
    challenge: string,
  ): Promise<Web3Session> {
    // 验证展示
    const isValidPresentation = await this.verifyPresentation(presentation, challenge);
    if (!isValidPresentation) {
      throw new UnauthorizedException('Invalid verifiable presentation');
    }

    // 验证所有凭证
    for (const credential of presentation.verifiableCredential) {
      const verification = await this.credentialManager.verifyCredential(credential);
      if (!verification.valid) {
        throw new UnauthorizedException(`Invalid credential: ${verification.reason}`);
      }
    }

    const holderDID = await this.didManager.resolveDID(presentation.holder);
    if (!holderDID) {
      throw new UnauthorizedException('Holder DID not found');
    }

    // 创建会话
    const session: Web3Session = Web3SessionSchema.parse({
      id: this.generateSessionId(),
      did: presentation.holder,
      address: holderDID.address,
      chainId: 1, // 默认以太坊主网
      nonce: challenge,
      message: 'Authenticated with verifiable credentials',
      signature: presentation.proof.signature,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      permissions: this.extractPermissionsFromCredentials(presentation.verifiableCredential),
    });

    this.sessions.set(session.id, session);
    this.eventEmitter.emit('web3.session.created', session);

    return session;
  }

  /**
   * 验证会话
   */
  async validateSession(sessionId: string): Promise<Web3Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.eventEmitter.emit('web3.session.expired', session);
      return null;
    }

    return session;
  }

  /**
   * 撤销会话
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);
    this.eventEmitter.emit('web3.session.revoked', session);
    
    return true;
  }

  /**
   * 获取用户权限
   */
  async getUserPermissions(sessionId: string): Promise<string[]> {
    const session = await this.validateSession(sessionId);
    return session?.permissions || [];
  }

  private async verifyWalletSignature(
    address: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    // 简化的钱包签名验证
    // 实际实现中会使用ethers.js或web3.js进行验证
    try {
      // 模拟签名验证
      const hash = crypto.createHash('sha256').update(message).digest('hex');
      return hash.length === 64; // 简化验证
    } catch (error) {
      this.logger.error('Wallet signature verification failed:', error);
      return false;
    }
  }

  private async findDIDByAddress(address: string): Promise<DID | null> {
    // 查找与地址关联的DID
    for (const did of Array.from(this.didManager['dids'].values())) {
      if (did.address === address) {
        return did;
      }
    }
    return null;
  }

  private async verifyPresentation(
    presentation: VerifiablePresentation,
    challenge: string,
  ): Promise<boolean> {
    if (presentation.proof.challenge !== challenge) {
      return false;
    }

    const holder = await this.didManager.resolveDID(presentation.holder);
    if (!holder) {
      return false;
    }

    const message = JSON.stringify({
      id: presentation.id,
      credentials: presentation.verifiableCredential.map(c => c.id),
      challenge,
    });

    return this.verifySignature(message, presentation.proof.signature, holder.publicKey);
  }

  private extractPermissionsFromCredentials(credentials: VerifiableCredential[]): string[] {
    const permissions = new Set<string>();
    
    for (const credential of credentials) {
      // 根据凭证类型提取权限
      if (credential.type.includes('AdminCredential')) {
        permissions.add('admin');
      }
      if (credential.type.includes('DeveloperCredential')) {
        permissions.add('develop');
      }
      if (credential.type.includes('UserCredential')) {
        permissions.add('read');
        permissions.add('write');
      }
    }

    return Array.from(permissions);
  }

  private verifySignature(message: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      verify.end();
      
      const publicKeyObj = crypto.createPublicKey({
        key: Buffer.from(publicKey, 'hex'),
        format: 'der',
        type: 'spki',
      });
      
      return verify.verify(publicKeyObj, signature, 'hex');
    } catch (error) {
      this.logger.error('Signature verification failed:', error);
      return false;
    }
  }

  private startSessionCleanup() {
    setInterval(() => {
      const now = new Date();
      
      // 清理过期会话
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          this.sessions.delete(sessionId);
          this.eventEmitter.emit('web3.session.expired', session);
        }
      }

      // 清理过期nonce
      for (const [address, nonceData] of this.nonces.entries()) {
        if (now > nonceData.expiresAt) {
          this.nonces.delete(address);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  private generateSessionId(): string {
    return `web3_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }
}

/**
 * 智能合约交互服务
 * 管理与区块链智能合约的交互
 */
@Injectable()
export class SmartContractService {
  private readonly logger = new Logger(SmartContractService.name);
  private readonly contracts = new Map<string, SmartContract>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 注册智能合约
   */
  async registerContract(
    address: string,
    abi: any[],
    chainId: number,
    network: string,
  ): Promise<SmartContract> {
    const contract: SmartContract = SmartContractSchema.parse({
      address,
      abi,
      chainId,
      network,
      deployedAt: new Date(),
      verified: false,
    });

    this.contracts.set(address, contract);
    this.eventEmitter.emit('web3.contract.registered', contract);
    
    this.logger.log(`Smart contract registered: ${address} on ${network}`);
    return contract;
  }

  /**
   * 调用智能合约方法
   */
  async callContract(
    contractAddress: string,
    methodName: string,
    args: any[] = [],
    options: { from?: string; value?: string; gas?: number } = {},
  ): Promise<any> {
    const contract = this.contracts.get(contractAddress);
    if (!contract) {
      throw new Error(`Contract not found: ${contractAddress}`);
    }

    // 模拟智能合约调用
    // 实际实现中会使用ethers.js或web3.js
    this.logger.log(`Calling contract method: ${methodName} on ${contractAddress}`);
    
    // 模拟调用结果
    const result = {
      transactionHash: crypto.randomBytes(32).toString('hex'),
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: options.gas || 21000,
      status: 'success',
      returnValue: `Result of ${methodName}`,
    };

    this.eventEmitter.emit('web3.contract.called', {
      contract,
      methodName,
      args,
      result,
    });

    return result;
  }

  /**
   * 监听智能合约事件
   */
  async subscribeToEvents(
    contractAddress: string,
    eventName: string,
    callback: (event: any) => void,
  ): Promise<string> {
    const contract = this.contracts.get(contractAddress);
    if (!contract) {
      throw new Error(`Contract not found: ${contractAddress}`);
    }

    const subscriptionId = crypto.randomUUID();
    
    // 模拟事件监听
    // 实际实现中会设置区块链事件监听器
    this.logger.log(`Subscribing to event: ${eventName} on ${contractAddress}`);

    // 模拟定期触发事件
    const interval = setInterval(() => {
      const mockEvent = {
        event: eventName,
        address: contractAddress,
        blockNumber: Math.floor(Math.random() * 1000000),
        transactionHash: crypto.randomBytes(32).toString('hex'),
        args: { mockData: 'test' },
      };
      callback(mockEvent);
    }, 30000); // 每30秒触发一次模拟事件

    // 存储订阅信息以便后续取消
    setTimeout(() => clearInterval(interval), 300000); // 5分钟后自动取消

    return subscriptionId;
  }

  /**
   * 获取合约信息
   */
  getContract(address: string): SmartContract | undefined {
    return this.contracts.get(address);
  }

  /**
   * 获取所有注册的合约
   */
  getAllContracts(): SmartContract[] {
    return Array.from(this.contracts.values());
  }
}