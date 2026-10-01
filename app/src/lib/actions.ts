import { BN } from "@anchor-lang/core";
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { MPL_CORE_ID, pdas, type BulbulProgram } from "./program";
import { associatedTokenAddress, createAtaIdempotentIx, TOKEN_PROGRAM_ID } from "./token";

export type ForfeitMode = "soft" | "charity" | "pool";

export interface ChainConfig {
  usdcMint: PublicKey;
  charityTokenAccount: PublicKey;
  poolVault: PublicKey;
  restrictedRegions: string[];
  companionUriBase: string;
  paused: boolean;
}

const regionBytes = (code: string) => [...Buffer.from(code.toUpperCase())];

/** Instruction builders. Each returns instructions plus any extra signer the tx needs. */
export function actions(program: BulbulProgram, owner: PublicKey, config: ChainConfig) {
  const ownerUsdc = associatedTokenAddress(owner, config.usdcMint);
  const profile = pdas.profile(owner);

  return {
    ownerUsdc,

    async initProfile(region: string): Promise<TransactionInstruction[]> {
      return [
        await program.methods
          .initProfile(regionBytes(region))
          .accountsStrict({ owner, profile, systemProgram: SystemProgram.programId })
          .instruction(),
      ];
    },

    async mintCompanion(): Promise<{ ixs: TransactionInstruction[]; signers: Keypair[] }> {
      const asset = Keypair.generate();
      const ix = await program.methods
        .mintCompanion()
        .accountsStrict({
          owner,
          config: pdas.config(),
          profile,
          asset: asset.publicKey,
          companionAuthority: pdas.companionAuth(),
          mplCoreProgram: MPL_CORE_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      return { ixs: [ix], signers: [asset] };
    },

    async evolveCompanion(asset: PublicKey): Promise<TransactionInstruction[]> {
      return [
        await program.methods
          .evolveCompanion()
          .accountsStrict({
            payer: owner,
            config: pdas.config(),
            profile,
            asset,
            companionAuthority: pdas.companionAuth(),
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ];
    },

    async createGoal(goalId: number, name: string, target: bigint, unlockAt: number): Promise<TransactionInstruction[]> {
      const goal = pdas.goal(owner, goalId);
      return [
        await program.methods
          .createGoal(name, new BN(target.toString()), new BN(unlockAt))
          .accountsStrict({
            owner,
            config: pdas.config(),
            profile,
            goal,
            vault: pdas.goalVault(goal),
            usdcMint: config.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ];
    },

    async deposit(goal: PublicKey, amount: bigint): Promise<TransactionInstruction[]> {
      return [
        await program.methods
          .depositGoal(new BN(amount.toString()))
          .accountsStrict({
            owner,
            config: pdas.config(),
            goal,
            vault: pdas.goalVault(goal),
            ownerTokenAccount: ownerUsdc,
            usdcMint: config.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ];
    },

    async closeGoal(goal: PublicKey, kind: "complete" | "break"): Promise<TransactionInstruction[]> {
      const accounts = {
        owner,
        config: pdas.config(),
        profile,
        goal,
        vault: pdas.goalVault(goal),
        ownerTokenAccount: ownerUsdc,
        usdcMint: config.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      };
      const builder = kind === "complete" ? program.methods.completeGoal() : program.methods.breakGoal();
      // Payouts need the owner's USDC account to exist.
      return [createAtaIdempotentIx(owner, owner, config.usdcMint), await builder.accountsStrict(accounts).instruction()];
    },

    async createCommitment(p: {
      commitmentId: number;
      stake: bigint;
      focusMinutes: number;
      requiredCheckins: number;
      periodDays: number;
      mode: ForfeitMode;
    }): Promise<TransactionInstruction[]> {
      const commitment = pdas.commitment(owner, p.commitmentId);
      return [
        await program.methods
          .createCommitment(
            new BN(p.stake.toString()),
            p.focusMinutes,
            p.requiredCheckins,
            p.periodDays,
            { [p.mode]: {} } as never,
          )
          .accountsStrict({
            owner,
            config: pdas.config(),
            profile,
            commitment,
            escrow: pdas.escrow(commitment),
            ownerTokenAccount: ownerUsdc,
            usdcMint: config.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      ];
    },

    async settleCommitment(commitment: PublicKey): Promise<TransactionInstruction[]> {
      return [
        createAtaIdempotentIx(owner, owner, config.usdcMint),
        await program.methods
          .settleCommitment()
          .accountsStrict({
            settler: owner,
            owner,
            config: pdas.config(),
            profile,
            commitment,
            escrow: pdas.escrow(commitment),
            ownerTokenAccount: ownerUsdc,
            charityTokenAccount: config.charityTokenAccount,
            poolVault: config.poolVault,
            usdcMint: config.usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction(),
      ];
    },
  };
}
