use crate::constants::*;

/// XP for completing a goal. Rewards both amount and how long it stayed locked,
/// so depositing a target and completing it instantly can't farm XP.
pub fn goal_xp(target_amount: u64, locked_seconds: i64) -> Option<u64> {
    let whole_usdc = (target_amount / ONE_USDC).min(GOAL_XP_USDC_CAP);
    let lock_days = u64::try_from(locked_seconds.max(0) / SECONDS_PER_DAY)
        .ok()?
        .min(GOAL_XP_FULL_LOCK_DAYS);
    let scaled = whole_usdc
        .checked_mul(lock_days)?
        .checked_div(GOAL_XP_FULL_LOCK_DAYS)?;
    GOAL_BASE_XP.checked_add(scaled)
}

pub fn commitment_xp(checkins: u8) -> Option<u64> {
    COMMITMENT_XP_PER_CHECKIN
        .checked_mul(u64::from(checkins))?
        .checked_add(COMMITMENT_BASE_XP)
}

pub fn pool_bonus(pool_balance: u64, stake: u64) -> Option<u64> {
    let from_pool = pool_balance
        .checked_mul(POOL_BONUS_OF_POOL_BPS)?
        .checked_div(BPS_DENOMINATOR)?;
    let from_stake = stake
        .checked_mul(POOL_BONUS_OF_STAKE_BPS)?
        .checked_div(BPS_DENOMINATOR)?;
    Some(from_pool.min(from_stake))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::Stage;

    #[test]
    fn goal_xp_scales_with_amount_and_lock() {
        assert_eq!(goal_xp(100 * ONE_USDC, 7 * SECONDS_PER_DAY), Some(50 + 100 * 7 / 180));
        assert_eq!(goal_xp(1_000 * ONE_USDC, 180 * SECONDS_PER_DAY), Some(1_050));
    }

    #[test]
    fn goal_xp_caps_amount_and_lock() {
        let capped = goal_xp(1_000 * ONE_USDC, 180 * SECONDS_PER_DAY);
        assert_eq!(goal_xp(u64::MAX, 10_000 * SECONDS_PER_DAY), capped);
    }

    #[test]
    fn goal_xp_ignores_negative_lock() {
        assert_eq!(goal_xp(500 * ONE_USDC, -5), Some(GOAL_BASE_XP));
    }

    #[test]
    fn commitment_xp_counts_checkins() {
        assert_eq!(commitment_xp(5), Some(70));
        assert_eq!(commitment_xp(u8::MAX), Some(20 + 10 * 255));
    }

    #[test]
    fn pool_bonus_takes_smaller_cap() {
        assert_eq!(pool_bonus(1_000, 100), Some(20));
        assert_eq!(pool_bonus(100, 1_000), Some(10));
        assert_eq!(pool_bonus(0, 1_000), Some(0));
    }

    #[test]
    fn stage_thresholds() {
        assert_eq!(Stage::from_xp(0), Stage::Curious);
        assert_eq!(Stage::from_xp(99), Stage::Curious);
        assert_eq!(Stage::from_xp(100), Stage::Focused);
        assert_eq!(Stage::from_xp(500), Stage::Evolving);
        assert_eq!(Stage::from_xp(2_000), Stage::Legendary);
        assert_eq!(Stage::from_xp(u64::MAX), Stage::Legendary);
    }
}
