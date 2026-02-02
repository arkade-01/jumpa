import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import QRCode from 'qrcode';

export interface PnlImageData {
  scenario: 'profit' | 'loss';
  tokenSymbol: string;
  tokenAmount: string;
  investedAmount: string;
  currentValue: string;
  pnlPercent: string;
  pnlAmount: string;
  entryPrice?: string;
  exitPrice?: string;
  referralCode?: string;
  telegramHandle?: string;
}

/**
 * Generate a high-quality P/L image 
 * @param data Trade data for the P/L image
 * @returns PNG image buffer
 */
export async function generatePnlImage(data: PnlImageData): Promise<Buffer> {
  // Higher resolution for better quality (3x scale)
  const scale = 3;
  const width = 800 * scale;
  const height = 556 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const font = "verdana";

  // Enable high quality rendering
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = '#941CF1';
  ctx.fillRect(0, 0, width, height);

  // Load Pepe image on the left side
  try {
    const pepeImagePath = data.scenario === 'profit'
      ? path.join(process.cwd(), 'src', 'images', 'pnl-profit-1.png')
      : path.join(process.cwd(), 'src', 'images', 'pnl-loss-1.png');

    const pepeImage = await loadImage(pepeImagePath);

    // Draw Pepe on left side
    const pepeSize = 520 * scale;
    const pepeX = 2 * scale;
    const pepeY = (height - pepeSize) / 2 * scale;
    ctx.drawImage(pepeImage, pepeX, pepeY, pepeSize, pepeSize);
  } catch (error) {
    console.error('Error loading Pepe image:', error);
  }

  // Load and draw logo in top right
  try {
    const logoPath = path.join(process.cwd(), 'src', 'images', 'logo.png');
    const logo = await loadImage(logoPath);
    const logoSize = 40 * scale;
    const logoX = width - 240 * scale;
    const logoY = 40 * scale;

    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    ctx.restore();

    // JumpaBot text next to logo - centered vertically
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${26 * scale}px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle'; // Center text vertically
    ctx.fillText('JumpaBot', logoX + logoSize + 15 * scale, logoY + logoSize / 2);
    ctx.textBaseline = 'alphabetic'; // Reset to default
  } catch (error) {
    console.error('Error loading logo:', error);
  }

  // Right side content - all right-aligned
  const rightX = width - 40 * scale; // Reduced padding for closer to edge

  // Token Symbol at top
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${36 * scale}px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(`$${data.tokenSymbol}`, rightX, 150 * scale);

  // P/L Percentage below symbol
  const plColor = data.scenario === 'profit' ? '#22C55E' : '#EF4444';
  ctx.fillStyle = plColor;
  ctx.font = `bold ${64 * scale}px ${font}`;
  ctx.fillText(data.pnlPercent, rightX, 240 * scale);

  // Entry and Exit prices
  ctx.fillStyle = '#E9D5FF';
  ctx.font = `${24 * scale}px ${font}`;
  ctx.fillText(`Entry ${data.entryPrice || data.investedAmount}`, rightX, 290 * scale);
  ctx.fillText(`Exit: ${data.exitPrice || data.currentValue}`, rightX, 325 * scale);

  // Telegram handle
  if (data.telegramHandle) {
    ctx.fillStyle = '#E9D5FF';
    ctx.font = `${20 * scale}px ${font}`;
    ctx.fillText(`TG: ${data.telegramHandle}`, rightX, 360 * scale);
  }

  // QR Code section - below token details, also right-aligned
  const qrSize = 120 * scale;
  const qrX = rightX - qrSize; // Right-aligned
  const qrY = 400 * scale; // Below token details

  // Generate real QR code
  try {
    // Bot deep link with referral code
    const botUsername = 'official_jumpa_bot';
    const qrCodeUrl = `https://t.me/${botUsername}?start=${data.referralCode || 'JUMPA'}`;

    // Generate QR code as data URL with higher error correction for logo overlay
    const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: qrSize / scale, // Original size before scaling
      margin: 1,
      errorCorrectionLevel: 'H', // High error correction allows up to 30% damage
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Load and draw QR code image
    const qrImage = await loadImage(qrCodeDataUrl);
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    // Add logo in center of QR code
    try {
      const logoPath = path.join(process.cwd(), 'src', 'images', 'logo.png');
      const qrLogo = await loadImage(logoPath);

      // Logo size: ~25% of QR code size
      const qrLogoSize = qrSize * 0.25;
      const qrLogoX = qrX + (qrSize - qrLogoSize) / 2;
      const qrLogoY = qrY + (qrSize - qrLogoSize) / 2;

      // Draw logo
      ctx.save();
      ctx.beginPath();
      ctx.arc(qrLogoX + qrLogoSize / 2, qrLogoY + qrLogoSize / 2, qrLogoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(qrLogo, qrLogoX, qrLogoY, qrLogoSize, qrLogoSize);
      ctx.restore();
    } catch (logoError) {
      console.error('Error adding logo to QR code:', logoError);
      // QR code still works without logo
    }
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Fallback to white box
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
  }

  // X: Jumpa Bot below QR
  ctx.fillStyle = '#E9D5FF';
  ctx.font = `${18 * scale}px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText('x.com/jumpabot', rightX, qrY + qrSize + 25 * scale);

  return canvas.toBuffer('image/png');
}
