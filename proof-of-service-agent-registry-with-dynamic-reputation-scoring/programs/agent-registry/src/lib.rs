use anchor_lang::prelude::*;

declare_id!("AgentRegistr111111111111111111111111111111111");

#[program]
pub mod agent_registry {
    use super::*;

    pub fn register_agent(ctx: Context<RegisterAgent>, metadata: AgentMetadata) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.authority = ctx.accounts.authority.key();
        agent.metadata = metadata;
        Ok(())
    }

    pub fn record_reputation(ctx: Context<RecordReputation>, delta: ReputationDelta) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.reputation_score = (agent.reputation_score + delta.score_change)
            .clamp(0, 10_000);
        agent.last_event = delta;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(init, payer = authority, space = AgentState::LEN)]
    pub agent: Account<'info, AgentState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordReputation<'info> {
    #[account(mut, has_one = authority)]
    pub agent: Account<'info, AgentState>,
    pub authority: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct AgentState {
    pub authority: Pubkey,
    pub metadata: AgentMetadata,
    pub reputation_score: i64,
    pub last_event: ReputationDelta,
}

impl AgentState {
    pub const LEN: usize = 8 + 32 + AgentMetadata::LEN + 8 + ReputationDelta::LEN;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct AgentMetadata {
    pub capabilities_uri: [u8; 64],
    pub disclosure: u8,
}

impl AgentMetadata {
    pub const LEN: usize = 64 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct ReputationDelta {
    pub score_change: i64,
    pub reference: [u8; 32],
}

impl ReputationDelta {
    pub const LEN: usize = 8 + 32;
}


