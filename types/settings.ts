export interface TelegramChat {
  id: string;
  name: string; // Chat 名稱（例如：主頻道、測試群組）
  botToken: string;
  chatId: string;
  isDefault?: boolean;
}

export interface UserSettings {
  telegramChats?: TelegramChat[];
  updatedAt?: Date;
  
  // 保留舊欄位以支援向後相容
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface SettingsFormData {
  telegramChats: TelegramChat[];
}
