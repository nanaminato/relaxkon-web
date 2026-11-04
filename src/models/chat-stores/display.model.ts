export interface DisplayModel{
  modelName: string;
  modelValue: string;
  vision?: boolean;
  internet?: boolean;
}
export class DisplayModelGenerator{
  generate(value: string,vision:boolean = false): DisplayModel{
    return {
      modelName: value,
      modelValue: value,
      vision: vision
    };
  }
  generateWithName(name: string, value: string,vision:boolean = false): DisplayModel{
    return {
      modelName: name,
      modelValue: value,
      vision: vision
    };
  }
}
export const generator = new DisplayModelGenerator();
// Offline examples only. Configured models are loaded from the server.
export const displayModels = [
  generator.generate('gpt-6-luna', true),
  generator.generate('claude-sonnet-5-5', true),
  generator.generate('claude-haiku-5-5', true),
  generator.generate('claude-opus-5-5', true),
  generator.generate('gemini-3.8-flash', true),
];
