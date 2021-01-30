import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

export default class S3Helper {
  private readonly s3Client: S3Client;

  constructor(private readonly region: string) {
    this.s3Client = new S3Client({ region: this.region });
  }

  putObject(bucketName: string, key: string, body: Buffer, contentType: string = 'image') {
    const command = new PutObjectCommand({
      Body: body,
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    return this.s3Client.send(command);
  }

  async getObjectAsBuffer(bucketName: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    const contentStream = Readable.from(response.Body);
    let contentBuffer = Buffer.from([]);

    for await (const chunk of contentStream) {
      contentBuffer = Buffer.concat([contentBuffer, chunk]);
    }

    return contentBuffer;
  }

  deleteObject(bucketName: string, key: string) {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    return this.s3Client.send(command);
  }
}
