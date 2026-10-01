use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub attestor: Pubkey,
    pub usdc_mint: Pubkey,
    pub charity_token_account: Pubkey,
    pub pool_vault: Pubkey,
    #[max_len(MAX_RESTRICTED_REGIONS)]
    pub restricted_regions: Vec<[u8; 2]>,
    #[max_len(MAX_URI_BASE_LEN)]
    pub companion_uri_base: String,
    pub paused: bool,
    pub bump: u8,
    pub pool_bump: u8,
}

impl Config {
    pub fn is_restricted(&self, region: &[u8; 2]) -> bool {
        self.restricted_regions.iter().any(|r| r == region)
    }
}

/// Public, on-chain reputation. Other apps can read it directly.
#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub owner: Pubkey,
    pub region: [u8; 2],
    pub xp: u64,
    pub verified_saved_total: u64,
    pub goals_created: u32,
    pub goals_completed: u32,
    pub goals_broken: u32,
    pub commitments_created: u32,
    pub commitments_succeeded: u32,
    pub commitments_failed: u32,
    pub companion: Pubkey,
    /// Stage last written to the companion asset.
    pub companion_stage: Stage,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug, InitSpace)]
pub enum Stage {
    Curious,
    Focused,
    Evolving,
    Legendary,
}

impl Stage {
    pub fn from_xp(xp: u64) -> Stage {
        if xp >= STAGE_XP_THRESHOLDS[3] {
            Stage::Legendary
        } else if xp >= STAGE_XP_THRESHOLDS[2] {
            Stage::Evolving
        } else if xp >= STAGE_XP_THRESHOLDS[1] {
            Stage::Focused
        } else {
            Stage::Curious
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Stage::Curious => "Curious",
            Stage::Focused => "Focused",
            Stage::Evolving => "Evolving",
            Stage::Legendary => "Legendary",
        }
    }

    pub fn slug(&self) -> &'static str {
        match self {
            Stage::Curious => "curious",
            Stage::Focused => "focused",
            Stage::Evolving => "evolving",
            Stage::Legendary => "legendary",
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct GoalVault {
    pub owner: Pubkey,
    pub id: u32,
    #[max_len(MAX_GOAL_NAME_LEN)]
    pub name: String,
    pub target_amount: u64,
    pub deposited: u64,
    pub created_at: i64,
    pub unlock_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ForfeitMode {
    /// Missed stake is returned; only the companion feels it.
    Soft,
    /// Missed stake is donated to the configured charity.
    Charity,
    /// Missed stake funds bonuses for people who succeed. Disabled in restricted regions.
    Pool,
}

#[account]
#[derive(InitSpace)]
pub struct Commitment {
    pub owner: Pubkey,
    pub id: u32,
    pub stake: u64,
    /// Continuous focus required for a day to count. Public so the attestor's rule is verifiable.
    pub focus_minutes: u16,
    pub required_checkins: u8,
    pub period_days: u8,
    pub checkins: u8,
    pub checkin_bitmap: u64,
    pub mode: ForfeitMode,
    pub created_at: i64,
    pub deadline: i64,
    pub bump: u8,
    pub escrow_bump: u8,
}

impl Commitment {
    pub fn succeeded(&self) -> bool {
        self.checkins >= self.required_checkins
    }
}
