//Get member profile from the JumpaGroup contract
import { Contract, ethers } from "ethers";
import { jumpaGroupAbi } from "./JumpaGroupAbi";
import { config } from "@core/config/environment";

const provider = new ethers.JsonRpcProvider(config.evmRpcUrl);

/** Get member profile
 * Retrieves a member's profile information from the group
 * Returns contribution amount, join time, and approval status
 */

export const getBaseMemberProfile = async (address: string, memberAddress: string) => {
  const contract = new Contract(address, jumpaGroupAbi.abi, provider);

  try {
    const profile = await contract.getMemberProfile(memberAddress);
    console.log("---- Member Profile ----", profile);

    // Destructure the MemberProfile struct
    const [contributionAmount, joinedAt, isApproved] = profile;

    return {
      success: true,
      data: {
        memberAddress: memberAddress,
        contributionAmount: contributionAmount?.toString(),
        joinedAt: Number(joinedAt),
        isApproved: isApproved as boolean,
      },
    };
  } catch (error) {
    console.log("short error msg", error.code);
    console.log("detailed error 2", error);
    return {
      success: false,
      data: error.code,
    };
  }
};
