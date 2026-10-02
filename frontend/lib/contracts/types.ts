/**
 * TypeScript types for the GenLayer Covenant contract
 */

export type CampaignStatus = "fundraising" | "active" | "completed" | "cancelled";
export type MilestoneStatus = "pending" | "verified" | "disputed" | "failed" | "paid";
export type CheckType = "github_merged" | "deployment_live" | "threshold";
export type ComparisonOp = ">=" | "<=" | "==" | ">" | "<";

export interface Campaign {
  recipient: string;
  title: string;
  description: string;
  total_raised: string; // wei, as decimal string
  total_released: string; // wei, as decimal string
  status: CampaignStatus;
  created_at: string;
}

export interface Milestone {
  campaign_id: string;
  description: string;
  target_amount: string; // wei, as decimal string
  check_type: CheckType;
  check_params: string; // JSON, shape depends on check_type
  status: MilestoneStatus;
  verified_at: string;
  challenge_reason: string;
  challenger: string;
  resolution_note: string;
  paid_amount: string;
  challenge_deadline: string;
}

export interface GithubMergedParams {
  repo: string; // "owner/repo"
  pr_number: number;
}

export interface DeploymentLiveParams {
  url: string;
  marker?: string;
}

export interface ThresholdParams {
  url: string;
  json_path: string;
  comparison_op: ComparisonOp;
  threshold_scaled: number; // the real value, already multiplied by 1e8, as an integer
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: any;
}
