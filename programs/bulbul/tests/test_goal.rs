mod common;

use {
    anchor_lang::prelude::Pubkey,
    bulbul::{constants::*, error::BulbulError, state::GoalVault, xp::goal_xp},
    common::*,
    solana_signer::Signer,
};

const DAY: i64 = SECONDS_PER_DAY;

#[test]
fn full_goal_lifecycle_awards_verified_xp() {
    let mut env = Env::new();
    let user = env.user(USA, 500 * ONE_USDC);
    let unlock_at = env.now() + 30 * DAY;
    let goal = env.create_goal(&user, "iPhone 17 Pro", 300 * ONE_USDC, unlock_at).unwrap();

    let state: GoalVault = env.account(&goal);
    assert_eq!(state.owner, user.key());
    assert_eq!(state.name, "iPhone 17 Pro");
    assert_eq!(state.target_amount, 300 * ONE_USDC);
    assert_eq!(env.profile(&user.key()).goals_created, 1);

    env.deposit(&user, goal, 200 * ONE_USDC).unwrap();
    env.deposit(&user, goal, 100 * ONE_USDC).unwrap();
    assert_eq!(env.balance(&goal_vault_pda(&goal)), 300 * ONE_USDC);
    assert_eq!(env.balance(&user.usdc), 200 * ONE_USDC);
    assert_eq!(env.account::<GoalVault>(&goal).deposited, 300 * ONE_USDC);

    env.advance(30 * DAY);
    env.complete_goal(&user, goal).unwrap();

    assert_eq!(env.balance(&user.usdc), 500 * ONE_USDC);
    assert!(!env.exists(&goal));
    assert!(!env.exists(&goal_vault_pda(&goal)));
    let profile = env.profile(&user.key());
    assert_eq!(profile.xp, goal_xp(300 * ONE_USDC, 30 * DAY).unwrap());
    assert_eq!(profile.verified_saved_total, 300 * ONE_USDC);
    assert_eq!(profile.goals_completed, 1);
}

#[test]
fn cannot_complete_before_unlock() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let goal = env.create_goal(&user, "Laptop", 50 * ONE_USDC, env.now() + 10 * DAY).unwrap();
    env.deposit(&user, goal, 50 * ONE_USDC).unwrap();
    env.advance(10 * DAY - 1);
    assert_err(env.complete_goal(&user, goal), BulbulError::GoalStillLocked);
    env.advance(1);
    env.complete_goal(&user, goal).unwrap();
}

#[test]
fn cannot_complete_below_target() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let goal = env.create_goal(&user, "Laptop", 80 * ONE_USDC, env.now() + 7 * DAY).unwrap();
    env.deposit(&user, goal, 79 * ONE_USDC).unwrap();
    env.advance(7 * DAY);
    assert_err(env.complete_goal(&user, goal), BulbulError::GoalTargetNotReached);
}

#[test]
fn break_returns_savings_without_xp() {
    let mut env = Env::new();
    let user = env.user(USA, 100 * ONE_USDC);
    let goal = env.create_goal(&user, "Trip", 90 * ONE_USDC, env.now() + 60 * DAY).unwrap();
    env.deposit(&user, goal, 40 * ONE_USDC).unwrap();
    env.break_goal(&user, goal).unwrap();
    assert_eq!(env.balance(&user.usdc), 100 * ONE_USDC);
    assert!(!env.exists(&goal));
    let profile = env.profile(&user.key());
    assert_eq!(profile.xp, 0);
    assert_eq!(profile.goals_broken, 1);
    assert_eq!(profile.verified_saved_total, 0);
}

#[test]
fn break_empty_goal_closes_accounts() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let goal = env.create_goal(&user, "Course", 5 * ONE_USDC, env.now() + 7 * DAY).unwrap();
    env.break_goal(&user, goal).unwrap();
    assert!(!env.exists(&goal_vault_pda(&goal)));
}

#[test]
fn rejects_bad_goal_params() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let now = env.now();
    assert_err(env.create_goal(&user, "", ONE_USDC, now + 7 * DAY), BulbulError::InvalidGoalName);
    let long = "x".repeat(MAX_GOAL_NAME_LEN + 1);
    assert_err(env.create_goal(&user, &long, ONE_USDC, now + 7 * DAY), BulbulError::InvalidGoalName);
    assert_err(env.create_goal(&user, "ok", ONE_USDC - 1, now + 7 * DAY), BulbulError::AmountTooSmall);
    assert_err(env.create_goal(&user, "ok", ONE_USDC, now + 7 * DAY - 1), BulbulError::InvalidUnlockTime);
    assert_err(env.create_goal(&user, "ok", ONE_USDC, now + 365 * DAY + 1), BulbulError::InvalidUnlockTime);
    env.create_goal(&user, "ok", ONE_USDC, now + 365 * DAY).unwrap();
}

#[test]
fn goal_ids_increment_per_user() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let a = env.create_goal(&user, "a", ONE_USDC, env.now() + 7 * DAY).unwrap();
    let b = env.create_goal(&user, "b", ONE_USDC, env.now() + 7 * DAY).unwrap();
    assert_eq!(a, goal_pda(&user.key(), 0));
    assert_eq!(b, goal_pda(&user.key(), 1));
}

#[test]
fn stranger_cannot_deposit_complete_or_break() {
    let mut env = Env::new();
    let user = env.user(USA, 50 * ONE_USDC);
    let stranger = env.user(USA, 50 * ONE_USDC);
    let goal = env.create_goal(&user, "Phone", 10 * ONE_USDC, env.now() + 7 * DAY).unwrap();
    env.deposit(&user, goal, 10 * ONE_USDC).unwrap();
    env.advance(7 * DAY);

    // Seeds bind the goal to its owner, so another signer can't address it.
    let ix = env.deposit_ix(&stranger.key(), stranger.usdc, goal, ONE_USDC);
    assert_custom(env.send(&[ix], &stranger.kp, &[]), ANCHOR_CONSTRAINT_SEEDS);
    assert_custom(env.complete_goal(&stranger, goal), ANCHOR_CONSTRAINT_SEEDS);
    assert_custom(env.break_goal(&stranger, goal), ANCHOR_CONSTRAINT_SEEDS);
    assert_eq!(env.balance(&goal_vault_pda(&goal)), 10 * ONE_USDC);
}

#[test]
fn deposit_from_foreign_token_account_rejected() {
    let mut env = Env::new();
    let user = env.user(USA, 50 * ONE_USDC);
    let other = env.user(USA, 50 * ONE_USDC);
    let goal = env.create_goal(&user, "Phone", 10 * ONE_USDC, env.now() + 7 * DAY).unwrap();
    let ix = env.deposit_ix(&user.key(), other.usdc, goal, ONE_USDC);
    assert_err(env.send(&[ix], &user.kp, &[]), BulbulError::WrongTokenOwner);
}

#[test]
fn deposit_with_wrong_mint_rejected() {
    let mut env = Env::new();
    let user = env.user(USA, 50 * ONE_USDC);
    let goal = env.create_goal(&user, "Phone", 10 * ONE_USDC, env.now() + 7 * DAY).unwrap();
    let fake_mint = Pubkey::new_unique();
    env.create_mint(fake_mint, USDC_DECIMALS);
    let fake_token = Pubkey::new_unique();
    env.create_token_account(fake_token, fake_mint, user.key(), 100 * ONE_USDC);
    let ix = env.deposit_ix(&user.key(), fake_token, goal, ONE_USDC);
    assert_err(env.send(&[ix], &user.kp, &[]), BulbulError::WrongMint);
}

#[test]
fn paused_blocks_new_goals_but_not_withdrawals() {
    let mut env = Env::new();
    let user = env.user(USA, 50 * ONE_USDC);
    let goal = env.create_goal(&user, "Phone", 10 * ONE_USDC, env.now() + 7 * DAY).unwrap();
    env.deposit(&user, goal, 10 * ONE_USDC).unwrap();

    let admin = env.admin.insecure_clone();
    let pause = env.update_config_ix(&admin.pubkey(), vec![INDIA], true);
    env.send(&[pause], &admin, &[]).unwrap();

    assert_err(env.create_goal(&user, "New", ONE_USDC, env.now() + 7 * DAY), BulbulError::Paused);
    env.break_goal(&user, goal).unwrap();
    assert_eq!(env.balance(&user.usdc), 50 * ONE_USDC);
}
