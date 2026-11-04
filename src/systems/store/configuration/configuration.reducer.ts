import {Configuration} from "../../../models";
import {configurationActions} from "./configuration.actions";
import {createReducer, on} from "@ngrx/store";

export interface ConfigurationState {
  config: Configuration | null;
}

export const initialConfigurationState: ConfigurationState = {
  config: null,
};
export const configurationReducer = createReducer(
  initialConfigurationState,
  on(configurationActions.load, (state) => ({
    ...state,
  })),
  on(configurationActions.loadSuccess, configurationActions.configUpdate, (state, { config }) => ({
    ...state,
    config,
  })),
);
