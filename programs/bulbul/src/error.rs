use anchor_lang::prelude::*;

#[error_code]
pub enum BulbulError {
    #[msg("Signer is not the program upgrade authority")]
    NotUpgradeAuthority,
    #[msg("Signer is not the config admin")]
    NotAdmin,
    #[msg("Signer is not the configured attestor")]
    NotAttestor,
    #[msg("Signer does not own this account")]
    NotOwner,
    #[msg("Mint must have 6 decimals")]
    InvalidMintDecimals,
    #[msg("Token account has the wrong mint")]
    WrongMint,
    #[msg("Token account has the wrong owner")]
    WrongTokenOwner,
    #[msg("Too many restricted regions")]
    TooManyRegions,
    #[msg("Region must be two uppercase ASCII letters")]
    InvalidRegion,
    #[msg("Companion URI base is too long")]
    UriTooLong,
    #[msg("New commitments and goals are paused")]
    Paused,
    #[msg("Goal name must be 1-32 bytes")]
    InvalidGoalName,
    #[msg("Amount is below the minimum")]
    AmountTooSmall,
    #[msg("Unlock time must be 7-365 days from now")]
    InvalidUnlockTime,
    #[msg("Goal target has not been reached")]
    GoalTargetNotReached,
    #[msg("Goal is still locked")]
    GoalStillLocked,
    #[msg("Period must be 1-64 days")]
    InvalidPeriod,
    #[msg("Required check-ins must be between 1 and the period length")]
    InvalidRequiredCheckins,
    #[msg("Focus minutes must be between 5 and 720")]
    InvalidFocusMinutes,
    #[msg("Pool mode is not available in your region; choose Soft or Charity")]
    ModeNotAllowedInRegion,
    #[msg("Commitment deadline has passed")]
    DeadlinePassed,
    #[msg("Day index is outside the commitment period")]
    DayOutOfRange,
    #[msg("Cannot check in for a future day")]
    FutureDay,
    #[msg("Already checked in for this day")]
    AlreadyCheckedIn,
    #[msg("Commitment can only be settled after the deadline unless it has already succeeded")]
    NotYetSettleable,
    #[msg("Companion already minted")]
    CompanionAlreadyMinted,
    #[msg("Companion has not been minted")]
    CompanionNotMinted,
    #[msg("Asset is not this profile's companion")]
    WrongCompanion,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
