import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Config } from "../../../config/configuration";
import type { GitProvider } from "../interfaces/git-provider.interface";
import { GitHubProvider } from "./github.provider";
import { GitLabProvider } from "./gitlab.provider";

@Injectable()
export class GitProviderFactory {
  constructor(private readonly configService: ConfigService<Config>) {}

  create(provider: string, accessToken: string, baseUrl?: string): GitProvider {
    switch (provider.toUpperCase()) {
      case "GITHUB":
        return new GitHubProvider(this.configService, accessToken);
      case "GITLAB":
        return new GitLabProvider(
          this.configService,
          accessToken,
          baseUrl || this.configService.get("oauth.gitlab.baseUrl", { infer: true })
        );
      case "GITEA":
        throw new Error("Gitea provider not implemented yet");
      default:
        throw new Error(`Unsupported Git provider: ${provider}`);
    }
  }
}
