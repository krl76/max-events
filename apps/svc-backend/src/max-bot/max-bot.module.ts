// START_MODULE_CONTRACT
// PURPOSE: Nest module providing MaxBotClient from ConfigService MAX_BOT_TOKEN.
// SCOPE: Factory-wired MaxBotClient; exported for EventsModule.
// DEPENDS: @nestjs/config, ./max-bot.client
// LINKS: M-SVC-BACKEND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - MaxBotModule - provides and exports MaxBotClient
// END_MODULE_MAP

import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MaxBotClient, MAX_BOT_API_BASE_URL } from "./max-bot.client";

@Module({
  providers: [
    {
      provide: MaxBotClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new MaxBotClient(config.get<string>("MAX_BOT_TOKEN"), MAX_BOT_API_BASE_URL),
    },
  ],
  exports: [MaxBotClient],
})
export class MaxBotModule {}
