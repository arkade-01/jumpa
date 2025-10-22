//1. get order

async function makeTx() {

  const tokenAddress = "Fa7mkzDfzkgU2iQrwzpAvrpQoLFnMM85qnZCdaK4agQR";
  const amount = 0.1;
  const inputAmount = amount * 1e9; // Convert to lamports
  const slippage = 50; //0.5% slippage

  const orderResponse = await fetch(
    `https://lite-api.jup.ag/ultra/v1/order` +
    `?inputMint=So11111111111111111111111111111111111111112` +
    `&outputMint=${tokenAddress}` +
    `&amount=${inputAmount}` +
    `&slippage=${slippage}`+
    `&taker=2gLYJH6M6dn5LYESpvBgDy6Q4bxKQjKK1kwBqPedAsBd`
  );
    const orderData = await orderResponse.json();
  console.log(orderData);
}
makeTx();