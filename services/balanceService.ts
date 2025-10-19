import AjoGroup from "../models/ajoGroup";

/**
 * Update group balance based on member contributions
 */
export async function updateGroupBalance(group_id: string) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    // Calculate total balance from member contributions
    const totalBalance = ajoGroup.members.reduce(
      (total, member) => total + member.contribution,
      0
    );

    ajoGroup.current_balance = totalBalance;
    await ajoGroup.save();

    console.log(`Group balance updated: ${totalBalance} SOL`);
    return totalBalance;
  } catch (error) {
    console.error("Error updating group balance:", error);
    throw error;
  }
}

/**
 * Calculate profit share percentage for each member
 */
export function calculateProfitShares(ajoGroup: any): Array<{
  user_id: number;
  contribution: number;
  share_percentage: number;
  share_amount?: number;
}> {
  const totalBalance = ajoGroup.current_balance;

  if (totalBalance === 0) {
    return ajoGroup.members.map((member: any) => ({
      user_id: member.user_id,
      contribution: member.contribution,
      share_percentage: 0,
    }));
  }

  return ajoGroup.members.map((member: any) => {
    const sharePercentage = (member.contribution / totalBalance) * 100;
    return {
      user_id: member.user_id,
      contribution: member.contribution,
      share_percentage: Math.round(sharePercentage * 100) / 100, // Round to 2 decimal places
    };
  });
}

/**
 * Calculate profit distribution
 */
export function calculateProfitDistribution(
  ajoGroup: any,
  totalProfit: number
): Array<{
  user_id: number;
  contribution: number;
  share_percentage: number;
  profit_share: number;
}> {
  const profitShares = calculateProfitShares(ajoGroup);

  return profitShares.map((share) => ({
    user_id: share.user_id,
    contribution: share.contribution,
    share_percentage: share.share_percentage,
    profit_share:
      Math.round(((totalProfit * share.share_percentage) / 100) * 100) / 100,
  }));
}

/**
 * Get member's contribution and share info
 */
export function getMemberShareInfo(
  ajoGroup: any,
  user_id: number
): {
  contribution: number;
  share_percentage: number;
  rank: number;
} | null {
  const member = ajoGroup.members.find((m: any) => m.user_id === user_id);
  if (!member) {
    return null;
  }

  const totalBalance = ajoGroup.current_balance;
  const sharePercentage =
    totalBalance > 0 ? (member.contribution / totalBalance) * 100 : 0;

  // Calculate rank based on contribution
  const sortedMembers = [...ajoGroup.members].sort(
    (a: any, b: any) => b.contribution - a.contribution
  );
  const rank = sortedMembers.findIndex((m: any) => m.user_id === user_id) + 1;

  return {
    contribution: member.contribution,
    share_percentage: Math.round(sharePercentage * 100) / 100,
    rank,
  };
}

/**
 * Get group financial summary
 */
export function getGroupFinancialSummary(ajoGroup: any): {
  total_balance: number;
  total_contributions: number;
  member_count: number;
  average_contribution: number;
  largest_contribution: number;
  smallest_contribution: number;
  profit_shares: Array<{
    user_id: number;
    contribution: number;
    share_percentage: number;
  }>;
} {
  const totalBalance = ajoGroup.current_balance;
  const totalContributions = ajoGroup.members.reduce(
    (total: number, member: any) => total + member.contribution,
    0
  );

  const contributions = ajoGroup.members.map((m: any) => m.contribution);
  const averageContribution =
    contributions.length > 0 ? totalContributions / contributions.length : 0;
  const largestContribution = Math.max(...contributions, 0);
  const smallestContribution = Math.min(...contributions, 0);

  const profitShares = calculateProfitShares(ajoGroup);

  return {
    total_balance: totalBalance,
    total_contributions: totalContributions,
    member_count: ajoGroup.members.length,
    average_contribution: Math.round(averageContribution * 100) / 100,
    largest_contribution: largestContribution,
    smallest_contribution: smallestContribution,
    profit_shares: profitShares,
  };
}

/**
 * Calculate group performance metrics
 */
export function calculateGroupPerformance(ajoGroup: any): {
  total_trades: number;
  successful_trades: number;
  total_volume: number;
  average_trade_size: number;
  roi_percentage: number;
} {
  const trades = ajoGroup.trades || [];
  const totalTrades = trades.length;
  const successfulTrades = trades.length; // Assuming all recorded trades are successful

  const totalVolume = trades.reduce(
    (total: number, trade: any) => total + trade.amount * trade.price_per_token,
    0
  );

  const averageTradeSize = totalTrades > 0 ? totalVolume / totalTrades : 0;

  // Calculate ROI based on current balance vs initial capital
  const initialCapital = ajoGroup.initial_capital;
  const currentBalance = ajoGroup.current_balance;
  const roiPercentage =
    initialCapital > 0
      ? ((currentBalance - initialCapital) / initialCapital) * 100
      : 0;

  return {
    total_trades: totalTrades,
    successful_trades: successfulTrades,
    total_volume: Math.round(totalVolume * 100) / 100,
    average_trade_size: Math.round(averageTradeSize * 100) / 100,
    roi_percentage: Math.round(roiPercentage * 100) / 100,
  };
}

/**
 * Track member contribution
 */
export async function trackMemberContribution(
  group_id: string,
  user_id: number,
  contribution: number
) {
  try {
    const ajoGroup = await AjoGroup.findById(group_id);
    if (!ajoGroup) {
      throw new Error("Ajo group not found");
    }

    const memberIndex = ajoGroup.members.findIndex(
      (member) => member.user_id === user_id
    );
    if (memberIndex === -1) {
      throw new Error("User is not a member of this group");
    }

    // Update member contribution
    ajoGroup.members[memberIndex].contribution = contribution;

    // Update group balance
    await updateGroupBalance(group_id);

    console.log(
      `Contribution tracked: User ${user_id} contributed ${contribution} SOL to group ${group_id}`
    );
    return ajoGroup;
  } catch (error) {
    console.error("Error tracking member contribution:", error);
    throw error;
  }
}

/**
 * Get member's financial summary
 */
export function getMemberFinancialSummary(
  ajoGroup: any,
  user_id: number
): {
  contribution: number;
  share_percentage: number;
  rank: number;
  potential_profit_share: number;
  is_trader: boolean;
} | null {
  const member = ajoGroup.members.find((m: any) => m.user_id === user_id);
  if (!member) {
    return null;
  }

  const shareInfo = getMemberShareInfo(ajoGroup, user_id);
  if (!shareInfo) {
    return null;
  }

  // Calculate potential profit share (assuming 10% profit for example)
  const potentialProfit = ajoGroup.current_balance * 0.1; // 10% profit assumption
  const potentialProfitShare =
    (potentialProfit * shareInfo.share_percentage) / 100;

  return {
    contribution: shareInfo.contribution,
    share_percentage: shareInfo.share_percentage,
    rank: shareInfo.rank,
    potential_profit_share: Math.round(potentialProfitShare * 100) / 100,
    is_trader: member.role === "trader",
  };
}

/**
 * Validate contribution amount
 */
export function validateContributionAmount(amount: number): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (amount < 0) {
    errors.push("Contribution amount must be non-negative");
  }

  if (amount > 1000000) {
    errors.push("Contribution amount cannot exceed 1,000,000 SOL");
  }

  // Check for reasonable decimal places (max 6 for SOL)
  const decimalPlaces = (amount.toString().split(".")[1] || "").length;
  if (decimalPlaces > 6) {
    errors.push("Contribution amount cannot have more than 6 decimal places");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate minimum contribution for meaningful share
 */
export function calculateMinimumMeaningfulContribution(ajoGroup: any): number {
  const totalBalance = ajoGroup.current_balance;
  const memberCount = ajoGroup.members.length;

  // Minimum contribution to get at least 1% share
  const minimumForOnePercent = totalBalance * 0.01;

  // Or minimum of $10 SOL
  const minimumAbsolute = 10;

  return Math.max(minimumForOnePercent, minimumAbsolute);
}
