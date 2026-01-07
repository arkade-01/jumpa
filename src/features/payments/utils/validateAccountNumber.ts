
import { config } from '@core/config/environment';

/**
 * Validates an account number using Paystack's bank resolve API.
 * @param accountNumber The account number to validate.
 * @param bankCode The bank code associated with the account number.
 * @returns The response from Paystack's bank resolve API.
 */
export async function validateAccountNumber(accountNumber: string, bankCode: string) {
  try {
    const validate = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.paystackBearerKey}`,
      },
    });
    const response = await validate.json();
    console.log('response from paystack', response);
    return response;
  } catch (error) {
    console.log(error);
    return null;
  }
}


// SAMPLE RESPONSE

// {
//   "status": true,
//     "message": "Account number resolved",
//       "data": {
//     "account_number": "0001234567",
//       "account_name": "Doe Jane Loren",
//         "bank_id": 9
//   }
// }