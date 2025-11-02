import AjoGroup from "@database/models/ajoGroup";
import { Types } from "mongoose";

export interface CreatePollParams {
  group_id: string;
  creator_id: number;
  type: "trade" | "end_ajo";
  title: string;
  token_address?: string;
  token_symbol?: string;
  amount?: number;
  expires_hours?: number;
}

export interface VoteParams {
  group_id: string;
  poll_id: string;
  user_id: number;
  vote: boolean;
}

/**
 * Create a new poll in an group
 */
export async function createPoll(params: CreatePollParams) {
  try {
    const ajoGroup = await AjoGroup.findById(params.group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    // Check if group is active
    if (ajoGroup.status !== "active") {
      throw new Error("Cannot create polls in inactive groups");
    }

    // Check if user is a trader (only traders can create polls)
    const creator = ajoGroup.members.find(
      (member) => member.user_id === params.creator_id
    );
    if (!creator) {
      throw new Error("You are not a member of this group");
    }
    if (creator.role !== "trader") {
      throw new Error("Only traders can create polls");
    }

    // Validate poll parameters
    if (params.type === "trade") {
      if (!params.token_address || !params.token_symbol || !params.amount) {
        throw new Error(
          "Trade polls require token address, symbol, and amount"
        );
      }
      if (params.amount <= 0) {
        throw new Error("Trade amount must be positive");
      }
    }

    // Generate unique poll ID
    const pollId = new Types.ObjectId().toString();
    const expiresHours = params.expires_hours || 24;
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    // Create the poll
    const newPoll = {
      id: pollId,
      creator_id: params.creator_id,
      type: params.type,
      title: params.title,
      token_address: params.token_address,
      token_symbol: params.token_symbol,
      amount: params.amount,
      status: "open",
      votes: [],
      created_at: new Date(),
      expires_at: expiresAt,
    };

    ajoGroup.polls.push(newPoll);
    await ajoGroup.save();

    console.log(`Poll created: ${params.title} (ID: ${pollId})`);
    return { poll: newPoll, ajoGroup };
  } catch (error) {
    console.error("Error creating poll:", error);
    throw error;
  }
}

/**
 * Vote on a poll
 */
export async function voteOnPoll(params: VoteParams) {
  try {
    const ajoGroup = await AjoGroup.findById(params.group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    // Find the poll
    const pollIndex = ajoGroup.polls.findIndex(
      (poll) => poll.id === params.poll_id
    );
    if (pollIndex === -1) {
      throw new Error("Poll not found");
    }

    const poll = ajoGroup.polls[pollIndex];

    // Check if poll is still open
    if (poll.status !== "open") {
      throw new Error("This poll is no longer open for voting");
    }

    // Check if poll has expired
    if (new Date() > poll.expires_at) {
      poll.status = "cancelled";
      await ajoGroup.save();
      throw new Error("This poll has expired");
    }

    // Check if user is a member
    const member = ajoGroup.members.find(
      (member) => member.user_id === params.user_id
    );
    if (!member) {
      throw new Error("You are not a member of this group");
    }

    // Check if user has already voted
    const existingVote = poll.votes.find(
      (vote) => vote.user_id === params.user_id
    );
    if (existingVote) {
      throw new Error("You have already voted on this poll");
    }

    // Add the vote
    poll.votes.push({
      user_id: params.user_id,
      vote: params.vote,
      voted_at: new Date(),
    });

    await ajoGroup.save();

    console.log(
      `Vote recorded: User ${params.user_id} voted ${
        params.vote ? "yes" : "no"
      } on poll ${params.poll_id}`
    );
    return { poll, ajoGroup };
  } catch (error) {
    console.error("Error voting on poll:", error);
    throw error;
  }
}

/**
 * Get poll information
 */
export async function getPoll(group_id: string, poll_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    const poll = ajoGroup.polls.find((poll) => poll.id === poll_id);
    if (!poll) {
      throw new Error("Poll not found");
    }

    return { poll, ajoGroup };
  } catch (error) {
    console.error("Error getting poll:", error);
    throw error;
  }
}

/**
 * Get all polls for a group
 */
export async function getGroupPolls(
  group_id: string,
  status?: "open" | "executed" | "cancelled"
) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    let polls = ajoGroup.polls;
    if (status) {
      polls = ajoGroup.polls.filter((poll) => poll.status === status) as any;
    }

    return { polls, ajoGroup };
  } catch (error) {
    console.error("Error getting group polls:", error);
    throw error;
  }
}

/**
 * Check if poll has reached consensus
 */
export function checkPollConsensus(poll: any, ajoGroup: any): boolean {
  if (poll.votes.length === 0) {
    return false;
  }

  // Calculate total voting power (based on contributions)
  const totalVotingPower = ajoGroup.members.reduce(
    (total: number, member: any) => total + member.contribution,
    0
  );

  if (totalVotingPower === 0) {
    return false;
  }

  // Calculate yes votes (weighted by contribution)
  const yesVotingPower = poll.votes
    .filter((vote: any) => vote.vote === true)
    .reduce((total: number, vote: any) => {
      const member = ajoGroup.members.find(
        (m: any) => m.user_id === vote.user_id
      );
      return total + (member ? member.contribution : 0);
    }, 0);

  const consensusPercentage = (yesVotingPower / totalVotingPower) * 100;
  return consensusPercentage >= ajoGroup.consensus_threshold;
}

/**
 * Execute a poll (mark as executed)
 */
export async function executePoll(group_id: string, poll_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    const pollIndex = ajoGroup.polls.findIndex((poll) => poll.id === poll_id);
    if (pollIndex === -1) {
      throw new Error("Poll not found");
    }

    const poll = ajoGroup.polls[pollIndex];

    // Check if poll is open
    if (poll.status !== "open") {
      throw new Error("Poll is not open for execution");
    }

    // Check if poll has reached consensus
    if (!checkPollConsensus(poll, ajoGroup)) {
      throw new Error("Poll has not reached consensus");
    }

    // Mark poll as executed
    ajoGroup.polls[pollIndex].status = "executed";

    // If it's a trade poll, add to trades
    if (poll.type === "trade") {
      ajoGroup.trades.push({
        poll_id: poll.id,
        token_symbol: poll.token_symbol,
        amount: poll.amount,
        price_per_token: 0, // Will be updated when trade is actually executed
        executed_at: new Date(),
      });
    }

    // If it's an end_poll, end the group
    if (poll.type === "end_ajo") {
      ajoGroup.status = "ended";
    }

    await ajoGroup.save();

    console.log(`Poll ${poll_id} executed successfully`);
    return { poll: ajoGroup.polls[pollIndex], ajoGroup };
  } catch (error) {
    console.error("Error executing poll:", error);
    throw error;
  }
}

/**
 * Cancel a poll
 */
export async function cancelPoll(group_id: string, poll_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    const pollIndex = ajoGroup.polls.findIndex((poll) => poll.id === poll_id);
    if (pollIndex === -1) {
      throw new Error("Poll not found");
    }

    const poll = ajoGroup.polls[pollIndex];

    // Check if poll is open
    if (poll.status !== "open") {
      throw new Error("Poll is not open for cancellation");
    }

    // Mark poll as cancelled
    ajoGroup.polls[pollIndex].status = "cancelled";
    await ajoGroup.save();

    console.log(`Poll ${poll_id} cancelled`);
    return { poll: ajoGroup.polls[pollIndex], ajoGroup };
  } catch (error) {
    console.error("Error cancelling poll:", error);
    throw error;
  }
}

/**
 * Get poll results with voting breakdown
 */
export async function getPollResults(group_id: string, poll_id: string) {
  try {
    const { poll, ajoGroup } = await getPoll(group_id, poll_id);

    const totalVotingPower = ajoGroup.members.reduce(
      (total: number, member: any) => total + member.contribution,
      0
    );

    const yesVotes = poll.votes.filter((vote: any) => vote.vote === true);
    const noVotes = poll.votes.filter((vote: any) => vote.vote === false);

    const yesVotingPower = yesVotes.reduce((total: number, vote: any) => {
      const member = ajoGroup.members.find(
        (m: any) => m.user_id === vote.user_id
      );
      return total + (member ? member.contribution : 0);
    }, 0);

    const noVotingPower = noVotes.reduce((total: number, vote: any) => {
      const member = ajoGroup.members.find(
        (m: any) => m.user_id === vote.user_id
      );
      return total + (member ? member.contribution : 0);
    }, 0);

    const consensusReached = checkPollConsensus(poll, ajoGroup);

    return {
      poll,
      results: {
        totalVotingPower,
        yesVotingPower,
        noVotingPower,
        yesPercentage:
          totalVotingPower > 0 ? (yesVotingPower / totalVotingPower) * 100 : 0,
        noPercentage:
          totalVotingPower > 0 ? (noVotingPower / totalVotingPower) * 100 : 0,
        consensusThreshold: ajoGroup.consensus_threshold,
        consensusReached,
        totalVotes: poll.votes.length,
        yesVotes: yesVotes.length,
        noVotes: noVotes.length,
      },
    };
  } catch (error) {
    console.error("Error getting poll results:", error);
    throw error;
  }
}

/**
 * Check and process expired polls
 */
export async function processExpiredPolls(group_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("group not found");
    }

    const now = new Date();
    let expiredCount = 0;

    for (const poll of ajoGroup.polls) {
      if (poll.status === "open" && now > poll.expires_at) {
        poll.status = "cancelled";
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      await ajoGroup.save();
      console.log(
        `Processed ${expiredCount} expired polls in group ${group_id}`
      );
    }

    return { expiredCount, ajoGroup };
  } catch (error) {
    console.error("Error processing expired polls:", error);
    throw error;
  }
}
