import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentRegistry } from "../target/types/agent_registry";

describe("agent registry program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.AgentRegistry as Program<AgentRegistry>;

  it("initializes a new agent account (mock assertion)", async () => {
    const wallet = (anchor.getProvider() as anchor.AnchorProvider).wallet;
    const agentKeypair = anchor.web3.Keypair.generate();

    await program.methods
      .registerAgent({
        capabilitiesUri: Array(64).fill(0),
        disclosure: 1
      })
      .accounts({
        agent: agentKeypair.publicKey,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([agentKeypair])
      .rpc();

    const account = await program.account.agentState.fetch(agentKeypair.publicKey);
    expect(account.reputationScore).toEqual(0);
  });
});


