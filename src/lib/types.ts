export interface TabItem {
    name: string;
    title: string;
    component: HTMLElement;
};

export interface GPTConfig {
    gptApiKey: string;
    gptMaxTokens: number;
    gptTemperature: number;
}
