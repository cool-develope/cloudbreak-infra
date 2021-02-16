import { S3Helper } from '@shared-code/index';

// @ts-ignore
import * as QRCode from 'qrcode';

// @ts-ignore
const sharp = require('sharp');

export default class QrFile {
  private readonly s3Helper: S3Helper;

  constructor(private region: string, private bucketName: string) {
    this.s3Helper = new S3Helper(this.region);
  }

  private async getQRCode(text: string, logoBuffer: Buffer): Promise<Buffer> {
    const qrWidth = 400;
    const logoWidth = 100;
    const pasteX = 400 / 2 - logoWidth / 2;

    /**
     * Generate QR Code
     */
    const qrCodeBuffer = await QRCode.toBuffer(text, {
      type: 'png',
      margin: 2,
      scale: 4,
      width: qrWidth,
      errorCorrectionLevel: 'H',
    });

    /**
     * Put logo on QR Code
     */
    const logoSharp = await sharp(logoBuffer).resize(logoWidth).toBuffer();
    const resultBuffer = await sharp(qrCodeBuffer)
      .composite([
        {
          input: logoSharp,
          top: pasteX,
          left: pasteX,
        },
      ])
      .png()
      .toBuffer();

    return resultBuffer;
  }

  private getS3KeyForQrCode(clubId: string, qrId: string) {
    return `club/${clubId}/qr/${qrId}.png`;
  }

  private async getLogo(): Promise<Buffer> {
    const s3Key = 'logo.jpeg';
    const logoBuffer = await this.s3Helper.getObjectAsBuffer(this.bucketName, s3Key);

    if (!logoBuffer) {
      throw Error(`S3 object is empty: ${s3Key}`);
    }

    return logoBuffer;
  }

  async createQR(clubId: string, qrId: string, text: string): Promise<string> {
    const logoBuffer = await this.getLogo();

    const qrS3Key = this.getS3KeyForQrCode(clubId, qrId);
    const qrCodeBuffer = await this.getQRCode(text, logoBuffer);
    await this.s3Helper.putObject(this.bucketName, qrS3Key, qrCodeBuffer);

    return qrS3Key;
  }

  async deleteQR(clubId: string, qrId: string) {
    const qrS3Key = this.getS3KeyForQrCode(clubId, qrId);
    await this.s3Helper.deleteObject(this.bucketName, qrS3Key);
  }
}
