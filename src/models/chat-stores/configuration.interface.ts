import {DisplayModel} from "./display.model";
import {ThemeId} from '../../themes/theme';


export interface Configuration{
  model: DisplayModel;
  chatConfiguration: ChatStreamConfiguration;
  displayConfiguration: DisplayConfiguration,
  dynamic?: string;
}
export interface DisplayConfiguration{
  fontSize?: string;
}
export const CONFIGURATION = "CONFIGURATION";
export interface ChatStreamConfiguration{
  models: DisplayModel[];
}

export interface DynamicConfig{
  systemInfo?: SystemInfoConfig;
  theme?: ThemeId;
  language?: string;
  languageIsSet?: boolean;
}
export interface SystemInfoConfig{
  letChoice?: boolean;// 打开新的聊天时让用户选择系统信息
}
