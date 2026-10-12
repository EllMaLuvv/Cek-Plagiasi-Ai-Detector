export interface PlagiarismSource {
  url: string;
  id: string;
}

export interface PlagiarismMatch {
  id: string;
  input_text_match: string;
  input_text_offset: number;
  input_token_count?: number;
  highlighted_snippet?: string;
  percent_similar: number;
  source?: PlagiarismSource;
}

export interface PlagiarismReport {
  id: string;
  status: string;
  percentage: number;
  score: number | null;
  word_count?: number;
  sentence_count?: number;
  input_text?: string;
  matches?: PlagiarismMatch[];
}

export interface AiSentenceMatch {
  sentence: string;
  generated_prob: number;
}

export interface AiReport {
  id: string;
  status: string;
  percentage: number;
  ai_score: string | null;
  ai_summary?: string;
  word_count?: number;
  sentence_count?: number;
  ai_matches?: AiSentenceMatch[];
}

export interface PartState<T> {
  progress: number;
  report: T | null;
  error?: string;
}

export interface CheckState {
  plagiarism: PartState<PlagiarismReport> | null;
  ai: PartState<AiReport> | null;
}
