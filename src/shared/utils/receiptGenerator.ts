import { createCanvas, loadImage } from "canvas";
import path from "path";

export interface TransactionReceiptData {
  amount: string;
  amountInCrypto: string;
  currency: string;
  timestamp: Date;
  network: string;
  fee?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

export async function generateTransactionReceipt(
  data: TransactionReceiptData
): Promise<Buffer> {
  // Create canvas at 2x resolution for higher quality
  const scale = 2;
  const width = 600 * scale;
  const height = 750 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Enable high quality rendering
  ctx.imageSmoothingEnabled = true;

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // Header section with gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 150 * scale);
  gradient.addColorStop(0, "#16213e");
  gradient.addColorStop(1, "#0f3460");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, 150 * scale);

  // Load and draw logo as circle
  try {
    const logoPath = path.join(process.cwd(), "src", "images", "logo.png");
    const logo = await loadImage(logoPath);
    const logoSize = 60 * scale;
    const logoX = width / 2;
    const logoY = 50 * scale;
    const logoRadius = logoSize / 2;

    // Create circular clipping path
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Draw logo image
    ctx.drawImage(
      logo,
      logoX - logoRadius,
      logoY - logoRadius,
      logoSize,
      logoSize
    );
    ctx.restore();
  } catch (error) {
    console.error("Error loading logo:", error);
  }

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${28 * scale}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("TRANSACTION RECEIPT", width / 2, 105 * scale);

  // Success indicator
  ctx.fillStyle = "#4ecca3";
  ctx.font = `bold ${18 * scale}px Arial`;
  ctx.fillText("withdrawal successful", width / 2, 130 * scale);

  // Divider line
  ctx.strokeStyle = "#4ecca3";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(50 * scale, 150 * scale);
  ctx.lineTo(width - 50 * scale, 150 * scale);
  ctx.stroke();

  // Amount section (very prominent and bold)
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${60 * scale}px Arial`;
  ctx.fillText(data.amount, width / 2, 230 * scale);

  // Details section
  const leftMargin = 80 * scale;
  const rightMargin = 80 * scale;
  let yPosition = 290 * scale;
  const lineHeight = 35 * scale;

  ctx.textAlign = "left";

  // Helper function to draw detail row (label and value on same line, left-aligned)
  const drawDetailRow = (label: string, value: string, y: number) => {
    // Truncate long values
    const maxValueWidth = 400 * scale;
    let displayValue = value;
    ctx.font = `bold ${16 * scale}px Arial`;
    if (ctx.measureText(value).width > maxValueWidth) {
      displayValue =
        value.substring(0, 15) + "..." + value.substring(value.length - 6);
    }

    // Draw label and value together (left-aligned)
    ctx.fillStyle = "#a8a8a8";
    ctx.font = `${16 * scale}px Arial`;
    const labelText = label + ": ";

    // Measure the label width
    const labelWidth = ctx.measureText(labelText).width;

    // Draw label (gray)
    ctx.fillStyle = "#a8a8a8";
    ctx.fillText(labelText, leftMargin, y);

    // Draw value (white, bold)
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${16 * scale}px Arial`;
    ctx.fillText(displayValue, leftMargin + labelWidth, y);
  };

  // Bank Account Details Section (if provided)
  if (data.bankName || data.accountName || data.accountNumber) {
    ctx.fillStyle = "#4ecca3";
    ctx.font = `bold ${20 * scale}px Arial`;
    ctx.fillText("RECIPIENT ACCOUNT DETAILS", leftMargin, yPosition);
    yPosition += 15 * scale;

    // Draw a line under the section header
    ctx.strokeStyle = "#4ecca3";
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(leftMargin, yPosition);
    ctx.lineTo(width - rightMargin, yPosition);
    ctx.stroke();
    yPosition += 30 * scale;

    if (data.bankName) {
      drawDetailRow("Bank Name", data.bankName, yPosition);
      yPosition += lineHeight;
    }

    if (data.accountName) {
      drawDetailRow("Account Name", data.accountName, yPosition);
      yPosition += lineHeight;
    }

    if (data.accountNumber) {
      drawDetailRow("Account Number", data.accountNumber, yPosition);
      yPosition += lineHeight;
    }

    yPosition += 20 * scale; // Extra spacing before transaction details
  }

  // Transaction Details Section
  ctx.fillStyle = "#4ecca3";
  ctx.font = `bold ${20 * scale}px Arial`;
  ctx.fillText("TRANSACTION DETAILS", leftMargin, yPosition);
  yPosition += 15 * scale;

  // Draw a line under the section header
  ctx.strokeStyle = "#4ecca3";
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(leftMargin, yPosition);
  ctx.lineTo(width - rightMargin, yPosition);
  ctx.stroke();
  yPosition += 30 * scale;

  // Draw transaction details

  drawDetailRow("Network", data.network, yPosition);
  yPosition += lineHeight;

  drawDetailRow("Date", data.timestamp.toLocaleString(), yPosition);
  yPosition += lineHeight;
  drawDetailRow(
    "Amount in " + data.currency,
    `${data.amountInCrypto} ${data.currency}`,
    yPosition
  );
  yPosition += lineHeight;

  if (data.fee) {
    drawDetailRow("Fee", `${data.fee} ${data.currency}`, yPosition);
    yPosition += lineHeight;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#4ecca3";
  ctx.font = `${14 * scale}px Arial`;
  ctx.fillText("Powered by Jumpa", width / 2, height - 30 * scale);

  // Convert to buffer
  return canvas.toBuffer("image/png");
}
