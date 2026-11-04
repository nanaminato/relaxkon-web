import {inject, Injectable} from "@angular/core";
import {DbService} from "./db.service";
import {Configuration} from "../../models";
import {displayModels} from "../../models";
export const timeToWait = 1;
@Injectable({
  providedIn: "root"
})
export class ConfigurationService {
  dbService: DbService = inject(DbService);
  default_configuration(): Configuration {
    return {
      model: {
        modelName: "gpt-4.1-mini",
        modelValue: "gpt-4.1-mini",
        vision: false
      },
      chatConfiguration: {
        models: displayModels
      },
      displayConfiguration: {
        fontSize: "14"
      },
      dynamic:""
    };
  }

  async getConfigFromDb(): Promise<Configuration | undefined> {
    return await this.dbService.getConfiguration();
  }
  // 保存配置到数据库
  async saveConfigToDb(configuration: Configuration) {
    if (!configuration) return;
    return await this.dbService.setConfiguration(configuration);
  }

  // 重置配置
  async resetConfig() {
    let config = this.default_configuration();
    await this.saveConfigToDb(config);
  }


}
