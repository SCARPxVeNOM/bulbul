use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const PROFILE_SEED: &[u8] = b"profile";
#[constant]
pub const GOAL_SEED: &[u8] = b"goal";
#[constant]
pub const GOAL_VAULT_SEED: &[u8] = b"goal_vault";
#[constant]
pub const COMMITMENT_SEED: &[u8] = b"commitment";
#[constant]
pub const ESCROW_SEED: &[u8] = b"escrow";
#[constant]
pub const POOL_SEED: &[u8] = b"pool";
#[constant]
pub const COMPANION_AUTH_SEED: &[u8] = b"companion_auth";

pub const USDC_DECIMALS: u8 = 6;
pub const ONE_USDC: u64 = 1_000_000;
pub const SECONDS_PER_DAY: i64 = 86_400;

pub const MIN_GOAL_AMOUNT: u64 = ONE_USDC;
pub const MIN_GOAL_LOCK_SECONDS: i64 = 7 * SECONDS_PER_DAY;
pub const MAX_GOAL_LOCK_SECONDS: i64 = 365 * SECONDS_PER_DAY;
pub const MAX_GOAL_NAME_LEN: usize = 32;

pub const MIN_STAKE: u64 = ONE_USDC;
/// Check-ins are tracked in a u64 bitmap, one bit per day.
pub const MAX_PERIOD_DAYS: u8 = 64;
pub const MIN_FOCUS_MINUTES: u16 = 5;
pub const MAX_FOCUS_MINUTES: u16 = 720;

pub const MAX_RESTRICTED_REGIONS: usize = 16;
pub const MAX_URI_BASE_LEN: usize = 96;

/// Pool bonus on a successful Pool-mode commitment: min(10% of pool, 20% of own stake).
pub const POOL_BONUS_OF_POOL_BPS: u64 = 1_000;
pub const POOL_BONUS_OF_STAKE_BPS: u64 = 2_000;
pub const BPS_DENOMINATOR: u64 = 10_000;

/// XP needed for Curious, Focused, Evolving, Legendary.
pub const STAGE_XP_THRESHOLDS: [u64; 4] = [0, 100, 500, 2_000];

pub const GOAL_BASE_XP: u64 = 50;
/// Saved amount (whole USDC) counted toward XP is capped so whales can't buy Legendary.
pub const GOAL_XP_USDC_CAP: u64 = 1_000;
pub const GOAL_XP_FULL_LOCK_DAYS: u64 = 180;

pub const COMMITMENT_BASE_XP: u64 = 20;
pub const COMMITMENT_XP_PER_CHECKIN: u64 = 10;

pub const COMPANION_NAME: &str = "bulbul";
