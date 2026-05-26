export type QualificationDecision = "Cualificado" | "No cualificado";

export type QualificationConfidence = "high" | "medium" | "low";

export type QualificationResult = {
  decision: QualificationDecision;
  reason: string;
  extracted: {
    business_type: string | null;
    employee_count: number | null;
    location: string | null;
    automation_or_ai_interest: boolean | null;
  };
  criteria: {
    services_or_consulting: boolean;
    min_5_employees: boolean;
    spain_or_latam: boolean;
    automation_or_ai_interest: boolean;
  };
  confidence: QualificationConfidence;
};

export type LeadSheetRow = {
  timestamp: string;
  telegramChatId: number | string;
  telegramMessageId: number | string;
  rawLeadText: string;
  qualification: QualificationResult;
};

export type AppConfig = {
  telegramBotToken: string;
  llmProvider: "openai";
  llmApiKey?: string;
  llmModel: string;
  googleSheetId?: string;
  googleServiceAccountEmail?: string;
  googlePrivateKey?: string;
  googleApplicationCredentials?: string;
  googleSheetTabName: string;
  nodeEnv: string;
};
