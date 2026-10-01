mod common;

use {
    bulbul::{
        constants::*,
        error::BulbulError,
        state::{Commitment, ForfeitMode},
        xp::{commitment_xp, pool_bonus},
    },
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
};

const DAY: i64 = SECONDS_PER_DAY;

/// Attest days 0..n, advancing a day between each so no future-day check-ins happen.
fn attest_days(env: &mut Env, commitment: anchor_lang::prelude::Pubkey, n: u8) {
    for day in 0..n {
        env.attest(commitment, day).unwrap();
        env.advance(DAY);
    }
}

#[test]
fn successful_streak_refunds_stake_and_awards_xp() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, 20 * ONE_USDC, 5, 7, ForfeitMode::Charity).unwrap();
    assert_eq!(env.balance(&user.usdc), 80 * ONE_USDC);
    assert_eq!(env.balance(&escrow_pda(&c)), 20 * ONE_USDC);

    attest_days(&mut env, c, 5);
    let state: Commitment = env.account(&c);
    assert_eq!(state.checkins, 5);
    assert_eq!(state.checkin_bitmap, 0b11111);

    // Succeeded early: settleable before the deadline, by anyone.
    let cranker = Keypair::new();
    env.svm.airdrop(&cranker.pubkey(), 1_000_000_000).unwrap();
    env.settle(&cranker, &user, c).unwrap();

    assert_eq!(env.balance(&user.usdc), 100 * ONE_USDC);
    assert_eq!(env.balance(&env.charity.clone()), 0);
    assert!(!env.exists(&c));
    assert!(!env.exists(&escrow_pda(&c)));
    let profile = env.profile(&user.key());
    assert_eq!(profile.xp, commitment_xp(5).unwrap());
    assert_eq!(profile.commitments_succeeded, 1);
    assert_eq!(profile.commitments_failed, 0);
}

#[test]
fn failed_soft_mode_returns_stake_without_xp() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, 10 * ONE_USDC, 3, 3, ForfeitMode::Soft).unwrap();
    attest_days(&mut env, c, 2);
    env.advance(DAY);
    let settler = user.kp.insecure_clone();
    env.settle(&settler, &user, c).unwrap();
    assert_eq!(env.balance(&user.usdc), 100 * ONE_USDC);
    let profile = env.profile(&user.key());
    assert_eq!(profile.xp, 0);
    assert_eq!(profile.commitments_failed, 1);
}

#[test]
fn failed_charity_mode_donates_stake() {
    let mut env = Env::new();
    let user = env.user(INDIA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, 25 * ONE_USDC, 2, 2, ForfeitMode::Charity).unwrap();
    env.advance(2 * DAY);
    let settler = user.kp.insecure_clone();
    env.settle(&settler, &user, c).unwrap();
    assert_eq!(env.balance(&env.charity.clone()), 25 * ONE_USDC);
    assert_eq!(env.balance(&user.usdc), 75 * ONE_USDC);
    assert_eq!(env.profile(&user.key()).commitments_failed, 1);
}

#[test]
fn pool_mode_redistributes_to_people_who_succeed() {
    let mut env = Env::new();
    let loser = env.user(USA, 100 * ONE_USDC);
    let winner = env.user(USA, 100 * ONE_USDC);

    let lc = env.create_commitment(&loser, 50 * ONE_USDC, 2, 2, ForfeitMode::Pool).unwrap();
    let wc = env.create_commitment(&winner, 40 * ONE_USDC, 2, 2, ForfeitMode::Pool).unwrap();

    env.attest(wc, 0).unwrap();
    env.advance(DAY);
    env.attest(wc, 1).unwrap();
    env.advance(DAY);

    let k = loser.kp.insecure_clone();
    env.settle(&k, &loser, lc).unwrap();
    assert_eq!(env.balance(&pool_pda()), 50 * ONE_USDC);

    let expected_bonus = pool_bonus(50 * ONE_USDC, 40 * ONE_USDC).unwrap();
    assert_eq!(expected_bonus, 5 * ONE_USDC);
    let k = winner.kp.insecure_clone();
    env.settle(&k, &winner, wc).unwrap();
    assert_eq!(env.balance(&winner.usdc), 100 * ONE_USDC + expected_bonus);
    assert_eq!(env.balance(&pool_pda()), 50 * ONE_USDC - expected_bonus);
}

#[test]
fn pool_mode_blocked_in_restricted_region() {
    let mut env = Env::new();
    let user = env.user(INDIA, 100 * ONE_USDC);
    assert_err(
        env.create_commitment(&user, 10 * ONE_USDC, 1, 1, ForfeitMode::Pool),
        BulbulError::ModeNotAllowedInRegion,
    );
    env.create_commitment(&user, 10 * ONE_USDC, 1, 1, ForfeitMode::Charity).unwrap();
    env.create_commitment(&user, 10 * ONE_USDC, 1, 1, ForfeitMode::Soft).unwrap();
}

#[test]
fn only_attestor_can_check_in() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, 10 * ONE_USDC, 1, 3, ForfeitMode::Soft).unwrap();
    let k = user.kp.insecure_clone();
    assert_err(env.attest_with(&k, c, 0), BulbulError::NotAttestor);
}

#[test]
fn checkin_rules_are_enforced() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, 10 * ONE_USDC, 3, 3, ForfeitMode::Soft).unwrap();

    assert_err(env.attest(c, 1), BulbulError::FutureDay);
    env.attest(c, 0).unwrap();
    assert_err(env.attest(c, 0), BulbulError::AlreadyCheckedIn);
    assert_err(env.attest(c, 3), BulbulError::DayOutOfRange);

    env.advance(3 * DAY);
    assert_err(env.attest(c, 2), BulbulError::DeadlinePassed);
}

#[test]
fn cannot_settle_unfinished_commitment_before_deadline() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, 10 * ONE_USDC, 2, 5, ForfeitMode::Charity).unwrap();
    env.attest(c, 0).unwrap();
    env.advance(5 * DAY - 1);
    let k = user.kp.insecure_clone();
    assert_err(env.settle(&k, &user, c), BulbulError::NotYetSettleable);
    env.advance(1);
    env.settle(&k, &user, c).unwrap();
}

#[test]
fn rejects_bad_commitment_params() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    assert_err(env.create_commitment(&user, MIN_STAKE - 1, 1, 1, ForfeitMode::Soft), BulbulError::AmountTooSmall);
    assert_err(env.create_commitment(&user, MIN_STAKE, 1, 0, ForfeitMode::Soft), BulbulError::InvalidPeriod);
    assert_err(env.create_commitment(&user, MIN_STAKE, 1, 65, ForfeitMode::Soft), BulbulError::InvalidPeriod);
    assert_err(env.create_commitment(&user, MIN_STAKE, 0, 5, ForfeitMode::Soft), BulbulError::InvalidRequiredCheckins);
    assert_err(env.create_commitment(&user, MIN_STAKE, 6, 5, ForfeitMode::Soft), BulbulError::InvalidRequiredCheckins);
    env.create_commitment(&user, MIN_STAKE, 64, 64, ForfeitMode::Soft).unwrap();
}

#[test]
fn focus_minutes_bounds_and_storage() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let soft = ForfeitMode::Soft;
    assert_err(env.create_focus_commitment(&user, MIN_STAKE, MIN_FOCUS_MINUTES - 1, 1, 1, soft), BulbulError::InvalidFocusMinutes);
    assert_err(env.create_focus_commitment(&user, MIN_STAKE, MAX_FOCUS_MINUTES + 1, 1, 1, soft), BulbulError::InvalidFocusMinutes);
    let c = env.create_focus_commitment(&user, MIN_STAKE, 120, 5, 7, soft).unwrap();
    let state: Commitment = env.account(&c);
    assert_eq!(state.focus_minutes, 120);
    assert_eq!(state.required_checkins, 5);
    assert_eq!(state.period_days, 7);
    assert_eq!(state.mode, ForfeitMode::Soft);
}

#[test]
fn full_64_day_bitmap_works() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let c = env.create_commitment(&user, MIN_STAKE, 64, 64, ForfeitMode::Soft).unwrap();
    attest_days(&mut env, c, 63);
    env.attest(c, 63).unwrap();
    let state: Commitment = env.account(&c);
    assert_eq!(state.checkin_bitmap, u64::MAX);
    assert_eq!(state.checkins, 64);
}

#[test]
fn settle_rejects_spoofed_owner_or_destinations() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let thief = env.user(USA, 0);
    let c = env.create_commitment(&user, 10 * ONE_USDC, 1, 1, ForfeitMode::Soft).unwrap();
    env.attest(c, 0).unwrap();
    // The thief passes themselves as owner (and their token account) for someone else's commitment.
    let k = thief.kp.insecure_clone();
    assert_err(env.settle(&k, &thief, c), BulbulError::NotOwner);
    assert_eq!(env.balance(&escrow_pda(&c)), 10 * ONE_USDC);
}

#[test]
fn paused_blocks_new_commitments() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let admin = env.admin.insecure_clone();
    let pause = env.update_config_ix(&admin.pubkey(), vec![INDIA], true);
    env.send(&[pause], &admin, &[]).unwrap();
    assert_err(env.create_commitment(&user, MIN_STAKE, 1, 1, ForfeitMode::Soft), BulbulError::Paused);
}
