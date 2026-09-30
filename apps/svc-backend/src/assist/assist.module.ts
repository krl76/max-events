// START_MODULE_CONTRACT
// PURPOSE: Nest module wiring NL assist (model API or keyword fallback + catalog match).
// SCOPE: LLM_PROVIDER factory, AssistService, controller; exports AssistService for the chat bot.
// DEPENDS: @nestjs/config, @nestjs/typeorm, events/checkins/friends/lists entities
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - createLlmProvider - model API when MODEL_API_KEY is set, otherwise the disabled provider
// - AssistModule - provides AssistService
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CheckInEntity } from "../checkins/check-in.entity";
import { DEFAULT_MODEL_API_MODELS, DEFAULT_MODEL_API_URL } from "../config/env";
import { EventEntity } from "../events/event.entity";
import { FriendshipEntity } from "../friends/friendship.entity";
import { ListItemEntity } from "../lists/list-item.entity";
import { ListEntity } from "../lists/list.entity";
import { PlansModule } from "../plans/plans.module";
import { AssistController } from "./assist.controller";
import { AssistRateLimiter } from "./rate-limit";
import { AssistService } from "./assist.service";
import { LLM_PROVIDER, type LlmProvider } from "./llm-provider";
import { ModelApiLlmProvider } from "./model-api-llm.provider";
import { NoneLlmProvider } from "./none-llm.provider";

export function createLlmProvider(apiKey: string | undefined, baseUrl: string, models: readonly string[]): LlmProvider {
  const list = models.map((model) => model.trim()).filter((model) => model.length > 0);
  if (!apiKey || list.length === 0) return new NoneLlmProvider();
  return new ModelApiLlmProvider(apiKey, baseUrl, list);
}

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, CheckInEntity, FriendshipEntity, ListEntity, ListItemEntity]), PlansModule],
  controllers: [AssistController],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLlmProvider(config.get<string>("MODEL_API_KEY"), config.get<string>("MODEL_API_URL") ?? DEFAULT_MODEL_API_URL, config.get<string[]>("MODEL_API_MODELS") ?? [...DEFAULT_MODEL_API_MODELS]),
    },
    AssistRateLimiter,
    AssistService,
  ],
  exports: [LLM_PROVIDER, AssistService],
})
export class AssistModule {}
