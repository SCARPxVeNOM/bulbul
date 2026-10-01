use anchor_lang::prelude::*;

use crate::state::{ForfeitMode, Stage};

#[event]
pub struct GoalCreated {
    pub owner: Pubkey,
    pub goal: Pubkey,
    pub target_amount: u64,
    pub unlock_at: i64,
}

#[event]
pub struct GoalDeposited {
    pub goal: Pubkey,
    pub amount: u64,
    pub deposited: u64,
}

#[event]
pub struct GoalCompleted {
    pub owner: Pubkey,
    pub goal: Pubkey,
    pub amount: u64,
    pub xp_gained: u64,
}

#[event]
pub struct GoalBroken {
    pub owner: Pubkey,
    pub goal: Pubkey,
    pub returned: u64,
}

#[event]
pub struct CommitmentCreated {
    pub owner: Pubkey,
    pub commitment: Pubkey,
    pub stake: u64,
    pub focus_minutes: u16,
    pub required_checkins: u8,
    pub period_days: u8,
    pub mode: ForfeitMode,
}

#[event]
pub struct CheckinAttested {
    pub commitment: Pubkey,
    pub day_index: u8,
    pub checkins: u8,
}

#[event]
pub struct CommitmentSettled {
    pub owner: Pubkey,
    pub commitment: Pubkey,
    pub succeeded: bool,
    pub mode: ForfeitMode,
    pub stake: u64,
    pub bonus: u64,
    pub xp_gained: u64,
}

#[event]
pub struct CompanionEvolved {
    pub owner: Pubkey,
    pub asset: Pubkey,
    pub from: Stage,
    pub to: Stage,
    pub xp: u64,
}
