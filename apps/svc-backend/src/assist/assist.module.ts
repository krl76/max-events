// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring NL assist (sandbox/none/xai LLM + catalog match).
// SCOPE: LLM_PROVIDER factory, AssistService, controller.
// DEPENDS: @nestjs/config, @nestjs/typeorm, events/checkins/friends/lists entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - createLlmProvider - sandbox / none / xai
// - AssistModule - provides AssistService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { PlansModule } from "../plans/plans.module";
import { AssistController } from "./assist.controller";
import { AssistRateLimiter } from "./rate-limit";
import { AssistService } from "./assist.service";
import { LLM_PROVIDER, type LlmProvider } from "./llm-provider";
import { NoneLlmProvider } from "./none-llm.provider";
import { SandboxLlmProvider } from "./sandbox-llm.provider";
import { XaiLlmProvider } from "./xai-llm.provider";

export function createLlmProvider(kind: string | undefined, apiKey: string | undefined, baseUrl: string, model: string): LlmProvider {
  if (kind === "none") return new NoneLlmProvider();
  if (kind === "xai") {
    if (!apiKey) return new NoneLlmProvider();
    return new XaiLlmProvider(apiKey, baseUrl, model);
  }
  if (kind === "sandbox" || kind == null || kind === "") return new SandboxLlmProvider();
  return new NoneLlmProvider();
}

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, CheckInEntity, FriendshipEntity, ListEntity, ListItemEntity]), PlansModule],
  controllers: [AssistController],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLlmProvider(config.get<string>("LLM_PROVIDER"), config.get<string>("XAI_API_KEY"), config.get<string>("XAI_API_URL") ?? "https://api.x.ai/v1", config.get<string>("XAI_MODEL") ?? "grok-4.5"),
    },
    AssistRateLimiter,
    AssistService,
  ],
})
export class AssistModule {}
